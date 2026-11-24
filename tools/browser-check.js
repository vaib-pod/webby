// Optional real Chromium DOM checks with mocked extension APIs and providers.
// No provider credentials or external requests are used.
import http from 'node:http';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import {checkInChromium} from './chromium.js';
import {toolsFixture,popupSetup,popupTests,restoredFixture,dashboardSetup,dashboardTests} from './accessibility-fixtures.js';
import {colourSetup,colourTests,colourAdaptationFixture} from './colour-fixtures.js';

const browser = process.env.WEBBY_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const extension = resolve('extension');
const stub = `<script>
window.listeners=[];window.calls=[];window.createdTabs=[];window.sessionStore={};window.storageListeners=[];
window.chrome={runtime:{id:'test',getURL:path=>new URL('/'+path,location.href).href,
  onMessage:{addListener(fn){listeners.push(fn);}},sendMessage(message,cb){cb?.({ok:true,data:{enabled:false}});}},
  storage:{onChanged:{addListener(fn){storageListeners.push(fn);}},session:{
    async get(key){return {[key]:sessionStore[key]};},
    async set(entries){const changes={};for(const [key,value] of Object.entries(entries)){
      changes[key]={oldValue:sessionStore[key],newValue:value};sessionStore[key]=value;
    }for(const cb of storageListeners)cb(changes,'session');},
    async remove(key){const prev=sessionStore[key];delete sessionStore[key];
      for(const cb of storageListeners)cb({[key]:{oldValue:prev,newValue:undefined}},'session');}
  }},
  tabs:{query:async()=>[{id:1,url:'https://example.com/article'}],
    get:async()=>({id:1,url:'https://example.com/article'}),
    create:async options=>{createdTabs.push(options);return {id:2,...options};},
    sendMessage:async(id,message)=>message.type==='GET_STATUS'?{ok:true,data:{sensitive:false}}:
      {ok:true,text:'Visible article text.',truncated:false}}};
window.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});
  if(url.endsWith('/summarize'))return new Response(JSON.stringify({summary:'A useful summary.',provider:'groq'}));
  const bytes=new Uint8Array(48044), view=new DataView(bytes.buffer);
  const label=(offset,text)=>bytes.set(new TextEncoder().encode(text),offset);
  label(0,'RIFF');view.setUint32(4,48036,true);label(8,'WAVE');label(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,24000,true);view.setUint32(28,48000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  label(36,'data');view.setUint32(40,48000,true);
  return new Response(bytes,{headers:{'Content-Type':'audio/wav'}});};
HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
HTMLMediaElement.prototype.pause=function(){};
HTMLMediaElement.prototype.load=function(){};
window.results=[];
window.check=(condition,name)=>results.push({name,ok:Boolean(condition)});
window.finish=()=>{const pre=document.createElement('pre');pre.id='browser-results';pre.textContent=JSON.stringify(results);document.body.append(pre);};
</script>`;
const privacyTests = `<script>
function message(type,sender={id:'test'}){let result;for(const fn of listeners)fn({type},sender,value=>result=value);return result;}
const before=message('GET_READING_TEXT');
check(before.ok&&before.text.includes('Public paragraph'),'extract visible article text');
check(!before.text.includes('SECRET'),'exclude forms, editors, hidden text and navigation');
check(message('GET_READING_TEXT',{id:'other'})===undefined,'reject unrelated senders');
document.querySelector('article').append(document.createTextNode('a'.repeat(13000)));
const long=message('GET_READING_TEXT');
check(long.truncated&&long.text.length===12000,'cap extracted text and report truncation');
const password=document.createElement('input');password.type='password';document.body.append(password);
check(message('GET_READING_TEXT').ok===false,'block password pages before extraction');
finish();
</script>`;
const uiTests = `<script type="module">
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms||35));
const until=async predicate=>{for(let i=0;i<80;i++){if(predicate())return;await wait();}throw new Error('Timeout waiting for UI');};
const el=id=>document.getElementById(id);
const toggle=id=>{el(id).checked=!el(id).checked;el(id).dispatchEvent(new Event('change'));};
try{
await until(()=>!el('loadReading').disabled);
check(el('summarize').disabled&&el('readText').disabled,'reading actions require consent');
el('loadReading').click();await until(()=>el('readingText').value==='Visible article text.');
check(calls.length===0&&sessionStore['webbyReadingSession:1']?.text==='Visible article text.','preview stays local and session-only');
toggle('readingConsent');
check(!el('summarize').disabled && !el('readText').disabled,'consent enables manual reading requests');
el('summarize').click();await until(()=>createdTabs.length===1);
check(calls.length===0&&createdTabs[0].url.includes('reading-workspace.html?tab=1&action=summary'),'summarize opens a persistent tab rather than fetching in a short-lived popup');
check(sessionStore['webbyReadingSession:1']?.requestedAction==='summary','explicit summarize action saved for workspace handoff');
await chrome.storage.session.set({'webbyReadingSession:1':{pageUrl:'https://example.com/article',text:'Visible article text.',summary:'A useful summary.',requestedAction:null,requestedAt:0}});
await wait();
check(el('readingSummary').textContent==='A useful summary.','reopened popup can display summary from session storage');
el('readSummary').click();await until(()=>createdTabs.length===2);
check(createdTabs[1].url.includes('action=summarySpeech'),'speech runs in a persistent tab');
el('readingText').value='Edited text';el('readingText').dispatchEvent(new Event('input'));
check(el('readingSummary').textContent===''&&el('readSummary').disabled,'editing the draft invalidates stale summary');
await until(()=>sessionStore['webbyReadingSession:1']?.text==='Edited text');
el('clearReading').click();await until(()=>!sessionStore['webbyReadingSession:1']);
check(!el('readingText').value&&!el('readingSummary').textContent,'explicit clear removes session-only reading data');
const before=createdTabs.length;window.chrome.tabs.get=async()=>({id:1,url:'https://example.com/changed'});
el('readingText').value='Text';el('readingText').dispatchEvent(new Event('input'));toggle('readingConsent');el('summarize').click();await wait();
check(createdTabs.length===before&&el('readingStatus').textContent.includes('navigated'),'navigation blocks upload of stale text');
}catch(error){check(false,'Popup persistence test error: '+error.stack);}
finish();
</script>`;
const workspaceTests = `<script type="module">
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms||40));
const until=async predicate=>{for(let i=0;i<80;i++){if(predicate())return;await wait();}throw new Error('Timeout waiting for workspace');};
const el=id=>document.getElementById(id);
try{
await until(()=>el('readingSummary').textContent==='A useful summary.');
check(calls.length===1&&calls[0].body.consent===true,'persistent tab performs consented summary request');
check(sessionStore['webbyReadingSession:1'].summary==='A useful summary.','completed summary saved independently of popup lifetime');
check(sessionStore['webbyReadingSession:1'].requestedAction===null,'one-time provider authorization is consumed');
el('readSummary').click();await until(()=>calls.length===2);
check(calls[1].body.text==='A useful summary.','persistent tab can read the restored summary aloud');
el('stopReading').click();await wait();
check(el('stopReading').disabled,'Stop halts persistent audio playback');
}catch(error){check(false,'Workspace persistence test error: '+error.stack);}
finish();
</script>`;

const server=http.createServer(async(req,res)=>{
  try {
    if(req.url==='/colour-adaptation') {res.setHeader('Content-Type','text/html');res.end(colourAdaptationFixture);return;}
    if(req.url==='/colour') {
      let html=await readFile(join(extension,'colour-vision.html'),'utf8');
      html=html.replace('<script type="module" src="colour-vision.js"></script>',colourSetup);
      res.setHeader('Content-Type','text/html');res.end(html.replace('</body>',`${colourTests}</body>`));return;
    }
    if(req.url==='/tools') {res.setHeader('Content-Type','text/html');res.end(toolsFixture);return;}
    if(req.url==='/restored') {res.setHeader('Content-Type','text/html');res.end(restoredFixture);return;}
    if(req.url==='/dashboard') {
      let html=await readFile(join(extension,'dashboard.html'),'utf8');
      html=html.replace('<script type="module" src="dashboard.js"></script>',dashboardSetup);
      res.setHeader('Content-Type','text/html');res.end(html.replace('</body>',`${dashboardTests}</body>`));return;
    }
    if(req.url==='/presets') {
      let html=await readFile(join(extension,'popup.html'),'utf8');
      html=html.replace('<script type="module" src="popup.js"></script>',popupSetup)
        .replace('<script type="module" src="reading-ui.js"></script>','');
      res.setHeader('Content-Type','text/html');res.end(html.replace('</body>',`${popupTests}</body>`));return;
    }
    if(req.url==='/privacy'){
      res.setHeader('Content-Type','text/html');
      res.end(`<html><body><article><p>Public paragraph.</p><form><p>SECRET form</p><input value="SECRET value"></form><div contenteditable>SECRET editor</div><p hidden>SECRET hidden</p><div style="display:none"><p>SECRET hidden ancestor</p></div><div aria-hidden="true">SECRET aria</div><nav>SECRET navigation</nav><p data-webby-exclude>SECRET excluded</p><div style="opacity:0">SECRET transparent</div></article>${stub}<script src="/content.js"></script>${privacyTests}</body></html>`);return;
    }
    if(req.url?.startsWith('/reading-workspace.html')) {
      let html=await readFile(join(extension,'reading-workspace.html'),'utf8');
      const setup=`<script>window.__preloaded=true;</script>`+stub+`<script>
        sessionStore['webbyReadingSession:1']={pageUrl:'https://example.com/article',text:'Visible article text.',summary:'',requestedAction:'summary',requestedAt:Date.now()};
      </script>`;
      html=html.replace('<script type="module" src="reading-ui.js"></script>',setup+'<script type="module" src="reading-ui.js"></script>');
      res.setHeader('Content-Type','text/html');res.end(html.replace('</body>',`${workspaceTests}</body>`));return;
    }
    if(req.url==='/reader'){
      let html=await readFile(join(extension,'popup.html'),'utf8');
      html=html.replace('<script type="module" src="popup.js"></script>',stub);
      res.setHeader('Content-Type','text/html');res.end(html.replace('</body>',`${uiTests}</body>`));return;
    }
    const file=resolve(extension,`.${new URL(req.url,'http://local').pathname}`);
    if(!file.startsWith(extension+sep)) {res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');
    res.end(await readFile(file));
  }catch {res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
  for(const route of ['privacy','reader','reading-workspace.html?tab=1&action=summary','tools','presets','restored','dashboard','colour','colour-adaptation']){
    const profile=await mkdtemp(join(tmpdir(),'webby-browser-'));
    try {
      const results=await checkInChromium(browser,profile,`http://127.0.0.1:${server.address().port}/${route}`);
      for(const result of results)console.log(`${result.ok?'PASS':'FAIL'}: ${result.name}`);
      if(results.some(result=>!result.ok))process.exitCode=1;
    }finally {await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
  }
}finally {await new Promise(resolve=>server.close(resolve));}
