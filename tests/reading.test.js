import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadConfig} from '../backend/config.js';
import {chatConfig} from '../backend/providers.js';
import {summarize, synthesize} from '../backend/reading.js';
import {speechChunks, validateTextRequest} from '../extension/shared/reading.js';
import {makeServer} from '../backend/server.js';

const consentText = {text:'Accessible pages use readable text and clear navigation.', consent:true};
function wav() {
  const bytes = Buffer.alloc(48);
  bytes.write('RIFF'); bytes.writeUInt32LE(40,4); bytes.write('WAVE',8);
  bytes.write('fmt ',12); bytes.writeUInt32LE(16,16); bytes.writeUInt16LE(1,20);
  bytes.writeUInt16LE(1,22); bytes.writeUInt32LE(24000,24); bytes.writeUInt32LE(48000,28);
  bytes.writeUInt16LE(2,32); bytes.writeUInt16LE(16,34); bytes.write('data',36); bytes.writeUInt32LE(4,40);
  return bytes;
}
const jsonResponse = content => new Response(JSON.stringify({choices:[{message:{content}}]}), {headers:{'Content-Type':'application/json'}});

test('env file loads without changing shell variables and allows missing files', async () => {
  const dir = await mkdtemp(join(tmpdir(),'webby-config-'));
  try {
    const file = join(dir,'.env');
    await writeFile(file, 'SUMMARY_PROVIDER=groq\nGROQ_API_KEY="local-key"\n');
    assert.deepEqual(loadConfig({GROQ_API_KEY:'shell-key'},file), {SUMMARY_PROVIDER:'groq',GROQ_API_KEY:'shell-key'});
    assert.deepEqual(loadConfig({PORT:'3001'},join(dir,'missing')), {PORT:'3001'});
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('provider routing never sends xAI credentials to Groq', () => {
  assert.equal(chatConfig({XAI_API_KEY:'xai-test'}).name,'xai');
  assert.equal(chatConfig({GROQ_API_KEY:'gsk_test'}).name,'groq');
  assert.throws(() => chatConfig({GROQ_API_KEY:'xai-test'}), /not a Groq key/);
  assert.throws(() => chatConfig({SUMMARY_PROVIDER:'arbitrary'}), /SUMMARY_PROVIDER/);
});

test('summary validates consent, uses the right API, and returns text without credentials', async () => {
  for (const [provider, env, host] of [
    ['groq',{GROQ_API_KEY:'gsk_test'},'api.groq.com'],
    ['xai',{XAI_API_KEY:'xai-test'},'api.x.ai']
  ]) {
    let calls = 0;
    const mockFetch = async (url, options) => {
      calls++;
      assert.equal(new URL(url).hostname,host);
      assert.ok(options.headers.Authorization.startsWith('Bearer '));
      assert.equal(options.redirect,'error');
      assert.equal(JSON.parse(options.body).messages[1].content,consentText.text);
      return jsonResponse('Readable text and clear navigation improve accessibility.');
    };
    await assert.rejects(summarize({text:'private'},env,mockFetch), /consent/);
    assert.equal(calls,0);
    const result = await summarize(consentText,env,mockFetch);
    assert.equal(result.provider,provider);
    assert.equal(result.summary,'Readable text and clear navigation improve accessibility.');
    assert.equal(calls,1);
  }
});

test('provider errors are actionable and do not expose response bodies or secrets', async () => {
  await assert.rejects(summarize(consentText,{}), error => error.status === 503);
  await assert.rejects(summarize(consentText,{GROQ_API_KEY:'secret'},async () => new Response('secret provider debug',{status:401})),
    error => error.status === 502 && /401/.test(error.message) && !/secret/.test(error.message));
  await assert.rejects(summarize(consentText,{GROQ_API_KEY:'secret'},async () => jsonResponse('')), /no text/);
  await assert.rejects(summarize(consentText,{GROQ_API_KEY:'secret'},async () => {throw new DOMException('secret','TimeoutError');}), /timed out/);
});

test('xAI account errors identify credits without exposing provider details', async () => {
  const env={XAI_API_KEY:'xai-secret'};
  for (const details of [
    {error:"Your team private-team doesn't have any credits yet. Please purchase credits."},
    {error:{message:'Your team private-team has used all available credits or reached its monthly spending limit.'}},
    {message:'Your team private-team has insufficient credits.'}
  ]) {
    await assert.rejects(summarize(consentText,env,async()=>new Response(JSON.stringify(details),{status:403})),
      error=>error.status===502 && /no available credits/.test(error.message) &&
        /xAI Console/.test(error.message) && !/private-team|xai-secret/.test(error.message));
  }
  for (const body of [JSON.stringify({error:'private-team has no permission for this model'}),'private debug response']) {
    await assert.rejects(summarize(consentText,env,async()=>new Response(body,{status:403})),
      error=>error.status===502 && /HTTP 403/.test(error.message) && !/no available credits|private/.test(error.message));
  }
});

test('Gnani sends documented authentication and WAV settings, and validates binary output', async () => {
  const audio = await synthesize(consentText,{GNANI_API_KEY:'vach_test'},async (url,options) => {
    assert.equal(url,'https://api.vachana.ai/api/v1/tts/inference');
    assert.equal(options.headers['X-API-Key-ID'],'vach_test');
    const body = JSON.parse(options.body);
    assert.equal(body.model,'timbre-v2.5'); assert.equal(body.voice,'Kaveri');
    assert.equal(body.audio_config.container,'wav');
    assert.equal(body.text,consentText.text);
    return new Response(wav(),{headers:{'Content-Type':'audio/wav'}});
  });
  assert.deepEqual(audio,wav());
  await assert.rejects(synthesize(consentText,{}), error => error.status === 503);
  await assert.rejects(synthesize({...consentText,text:'x'.repeat(1501)},{GNANI_API_KEY:'test'}), /1500/);
  await assert.rejects(synthesize(consentText,{GNANI_API_KEY:'test'},async () => new Response('invalid')), /valid WAV/);
  await assert.rejects(synthesize(consentText,{GNANI_API_KEY:'test'},async () => new Response('secret',{status:429})),
    error => error.status === 429 && /Rate limit/.test(error.message));
});

test('text validation rejects missing consent, malformed and oversized text', () => {
  for (const text of ['', ' ', 123, null]) assert.throws(() => validateTextRequest({text,consent:true}));
  assert.throws(() => validateTextRequest({text:'x',consent:'true'}), /consent/);
  assert.throws(() => validateTextRequest({text:'x'.repeat(12001),consent:true}), /12000/);
});

test('speech chunking preserves long text and Unicode without splitting surrogate pairs', () => {
  for (const text of ['A readable sentence. '.repeat(500).trim(), 'x'.repeat(3500), '🎧'.repeat(1600), 'हिंदी पाठ '.repeat(300).trim()]) {
    const chunks = speechChunks(text);
    assert.ok(chunks.every(chunk => chunk.length > 0 && chunk.length <= 1500));
    assert.equal(chunks.join('').replace(/\s/g,''),text.replace(/\s/g,''));
    assert.ok(chunks.every(chunk => !/[\uD800-\uDBFF]$/.test(chunk)));
  }
  assert.deepEqual(speechChunks(' '),[]);
});

test('reading endpoints enforce origin, content type, consent, and body limits before provider calls', async () => {
  let calls = 0;
  const server = makeServer({GROQ_API_KEY:'secret',GNANI_API_KEY:'secret'},async url => {
    calls++;
    return url.includes('vachana') ? new Response(wav()) : jsonResponse('Summary.');
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const origin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  try {
    for (const route of ['summarize','speech']) {
      const post = (body,headers={}) => fetch(`${base}/api/${route}`, {method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify(body)});
      const before = calls;
      assert.equal((await post(consentText,{Origin:'https://evil.example'})).status,403);
      assert.equal((await post(consentText,{'Content-Type':'text/plain'})).status,415);
      assert.equal((await post({text:'without consent'})).status,403);
      assert.equal((await post({...consentText,text:42})).status,400);
      assert.equal((await post({...consentText,text:'x'.repeat(85000)})).status,413);
      assert.equal(calls,before);
      const response = await post(consentText);
      assert.equal(response.status,200);
      assert.equal(response.headers.get('access-control-allow-origin'),origin);
      assert.equal(response.headers.get('cache-control'),'no-store');
      if (route === 'speech') {
        assert.equal(response.headers.get('content-type'),'audio/wav');
        assert.deepEqual(Buffer.from(await response.arrayBuffer()),wav());
      } else assert.deepEqual(await response.json(),{summary:'Summary.',provider:'groq'});
    }
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.summaryConfigured,true); assert.equal(health.speechConfigured,true);
    assert.ok(!JSON.stringify(health).includes('secret'));
  } finally {await new Promise(resolve => server.close(resolve));}
});
