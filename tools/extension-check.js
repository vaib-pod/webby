// Real MV3 installation in a disposable Chrome profile. No mocked extension APIs.
import http from 'node:http';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {withChromium} from './chromium.js';

const html=`<!doctype html><html><body style="background:white;color:#111">
<main><form><button id="action" type="button" style="background:#b00;color:#fff"><svg width="16" height="16"><rect width="16" height="16" fill="currentColor"/></svg><span>Save changes</span></button>
<p>Some text and <a id="link" href="/unopened" style="color:blue">an unopened link</a>.</p>
<div id="warning" role="alert">Check these changes.</div></form></main>
</body></html>`;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const profile=await mkdtemp(join(tmpdir(),'webby-real-extension-'));
try{
  await withChromium(process.env.WEBBY_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',profile,async call=>{
    const {id}=await call('Extensions.loadUnpacked',{path:resolve('extension')});
    const evaluate=async(sessionId,expression)=>{
      const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
      if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
      return result.result.value;
    };
    const until=async(session,expression,name)=>{
      for(let attempt=0;attempt<100;attempt++){
        if(await evaluate(session,expression)){console.log('PASS: '+name);return;}
        await new Promise(done=>setTimeout(done,100));
      }
      throw new Error('Failed: '+name);
    };
    const page=async url=>{
      const {targetId}=await call('Target.createTarget',{url:'about:blank'});
      const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
      await call('Page.enable',{},sessionId);await call('Page.navigate',{url},sessionId);return sessionId;
    };
    const website=await page(`http://127.0.0.1:${server.address().port}/article`);
    await until(website,`document.documentElement.getAttribute('data-webby-active')==='1'`,'real manifest content scripts initialize on a website');
    const settings=await page(`chrome-extension://${id}/colour-vision.html#settings`);
    await until(settings,`document.getElementById('colourEnabled')?.disabled===false`,'real colour settings initialize with an operable Enable switch');
    const second=await page(`chrome-extension://${id}/colour-vision.html#settings`);
    await until(second,`document.getElementById('colourEnabled')?.disabled===false`,'second settings tab initializes');
    await evaluate(settings,`document.querySelector('input[value="purple-teal"]').click();document.getElementById('colourEnabled').click()`);
    await until(website,`getComputedStyle(document.getElementById('action')).backgroundColor==='rgb(102, 58, 130)'`,'saving through the real settings UI updates an already-open website');
    await until(second,`document.getElementById('colourEnabled').checked&&document.getElementById('savedPreference').textContent.includes('Purple & teal')`,'another settings tab tracks the saved preference');
    assert.equal(await evaluate(website,`getComputedStyle(document.getElementById('link')).color`),'rgb(0, 0, 255)');
    assert.equal(await evaluate(website,`getComputedStyle(document.querySelector('#action svg')).color`),'rgb(255, 255, 255)');
    console.log('PASS: native website links and button artwork retain their colours');
    await evaluate(settings,`(async()=>{const reply=await chrome.runtime.sendMessage({type:'GET_PROFILE'});return chrome.runtime.sendMessage({type:'SAVE_PROFILE',profile:{...reply.data,darkMode:true}});})()`);
    await until(website,`document.documentElement.getAttribute('data-webby-dark-mode')==='1'&&getComputedStyle(document.getElementById('action')).backgroundColor==='rgb(102, 58, 130)'`,'saved palette remains applied when real Dark Mode is enabled');
    await call('Page.reload',{},website);
    await until(website,`document.getElementById('action')&&document.documentElement.getAttribute('data-webby-dark-mode')==='1'&&getComputedStyle(document.getElementById('action')).backgroundColor==='rgb(102, 58, 130)'`,'refresh restores the saved palette with Dark Mode');
    await evaluate(settings,`document.getElementById('colourEnabled').click()`);
    await until(website,`!document.documentElement.hasAttribute('data-webby-colour')&&getComputedStyle(document.getElementById('action')).backgroundColor==='rgb(187, 0, 0)'`,'disabling from settings restores original website button styles');
    await evaluate(settings,`(async()=>{const reply=await chrome.runtime.sendMessage({type:'GET_PROFILE'});return chrome.runtime.sendMessage({type:'SAVE_PROFILE',profile:{...reply.data,enabled:false}});})()`);
    await until(settings,`document.getElementById('colourEnabled').disabled===false`,'settings switch remains usable while global WEBBY is paused');
    await evaluate(settings,`document.getElementById('colourEnabled').click()`);
    await until(settings,`document.getElementById('applicationStatus').textContent.includes('paused')`,'real settings explain global pause instead of reporting successful page adaptation');
    assert.equal(await evaluate(website,`document.documentElement.hasAttribute('data-webby-colour')`),false);
    console.log('PASS: global pause remains respected');
  },['--enable-unsafe-extension-debugging']);
}finally{
  await new Promise(done=>server.close(done));
  if(!resolve(profile).startsWith(resolve(tmpdir())+sep))throw new Error('Unexpected temporary profile path');
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
