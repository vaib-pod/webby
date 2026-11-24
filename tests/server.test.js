import test from 'node:test';
import assert from 'node:assert/strict';
import {makeServer} from '../backend/server.js';

test('HTTP backend exposes reading services and rejects removed routes and malformed JSON',async()=>{
  const server=makeServer({});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const health=await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.status,'ok');
    assert.equal(health.summaryConfigured,false);
    assert.equal(health.speechConfigured,false);
    const removed=await fetch(`${base}/api/analyze`,{method:'POST'});
    assert.equal(removed.status,404);
    const malformed=await fetch(`${base}/api/summarize`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:'{invalid'
    });
    assert.equal(malformed.status,400);
    const preflight=await fetch(`${base}/api/summarize`,{
      method:'OPTIONS',headers:{Origin:'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}
    });
    assert.equal(preflight.status,204);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
