import {speechChunks, MAX_READING_TEXT} from './shared/reading.js';

// A Chrome action popup is destroyed as soon as it closes. Long-running reading
// requests therefore start in a persistent extension tab, not in the popup.
// Only the draft and finished summary are cached in session-only local storage.
const $ = id => document.getElementById(id);
const isWorkspace = location.pathname.endsWith('/reading-workspace.html');
const query = new URLSearchParams(location.search);
const ACTIONS = new Set(['summary','textSpeech','summarySpeech']);
const API = 'http://127.0.0.1:3001/api';
let tabId, pageUrl, summary = '', summaryController, speechController, audioUrl;
let available = false, saveRevision = 0;
const sessionKey = () => `webbyReadingSession:${tabId}`;

function status(text, error = false) {
  $('readingStatus').textContent = text;
  $('readingStatus').className = error ? 'status error' : 'muted tiny';
}
function controls() {
  const busy = Boolean(summaryController || speechController);
  const hasText = Boolean($('readingText').value.trim());
  $('loadReading').disabled = !available || busy;
  $('readingText').disabled = !available || busy;
  $('readingConsent').disabled = !available;
  $('summarize').disabled = !available || busy || !hasText || !$('readingConsent').checked;
  $('readText').disabled = !available || busy || !hasText || !$('readingConsent').checked;
  $('readSummary').disabled = !available || busy || !summary || !$('readingConsent').checked;
  $('stopReading').disabled = !busy;
  if ($('openReadingWorkspace')) $('openReadingWorkspace').disabled = !available;
  if ($('clearReading')) $('clearReading').disabled = !available;
}
function renderSummary() {
  $('readingSummary').textContent = summary;
  $('readingSummary').classList.toggle('hidden',!summary);
  controls();
}
async function readSession() {
  if (!tabId) return null;
  const existing = (await chrome.storage.session.get(sessionKey()))[sessionKey()];
  return existing?.pageUrl === pageUrl ? existing : null;
}
async function saveSnapshot(action = null) {
  if (!tabId || !pageUrl) return;
  const revision = ++saveRevision;
  // Storage operations are serialized by UI events in normal use. Preserve the
  // one-shot action only when explicitly launching a persistent workspace.
  const record = {pageUrl,text:$('readingText').value.slice(0,MAX_READING_TEXT),
    summary,requestedAction:action,requestedAt:action?Date.now():0};
  await chrome.storage.session.set({[sessionKey()]:record});
  return revision;
}
function applySnapshot(state) {
  if (!state || state.pageUrl !== pageUrl || summaryController || speechController) return;
  if (typeof state.text === 'string') $('readingText').value = state.text.slice(0,MAX_READING_TEXT);
  summary = typeof state.summary === 'string' ? state.summary : '';
  renderSummary();
}
async function openWorkspace(action = null) {
  if (!available) return;
  if (action && !ACTIONS.has(action)) throw new Error('Unsupported reading action');
  if (action && !$('readingConsent').checked) throw new Error('Confirm consent before sending text.');
  await checkPage();
  await saveSnapshot(action);
  const url = chrome.runtime.getURL(`reading-workspace.html?tab=${tabId}${action?`&action=${action}`:''}`);
  await chrome.tabs.create({url});
  status(action ? 'Opened a persistent tab. The request continues there if you close this popup.' : 'Reading workspace opened in a tab.');
}
function releaseAudio() {
  const audio = $('readingAudio');
  audio.pause(); audio.removeAttribute('src'); audio.load(); audio.classList.add('hidden');
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
}
function stop() {
  summaryController?.abort(); speechController?.abort(); releaseAudio();
}
async function checkPage() {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url !== pageUrl) {
    available = false;
    throw new Error('The original tab navigated. Open WEBBY on the new page to continue.');
  }
  const reply = await chrome.tabs.sendMessage(tabId,{type:'GET_STATUS'});
  if (!reply?.ok || reply.data?.sensitive) throw new Error('Reading features are disabled on potentially sensitive pages.');
}
async function request(path,text,signal) {
  let response;
  try {
    response = await fetch(`${API}/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text,consent:true}),signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
  } catch(error) {
    if (signal.aborted) throw error;
    throw new Error(error.name==='TimeoutError' ? 'The request timed out. Try again.' : 'Cannot reach the local backend. Run npm run server.');
  }
  if (!response.ok) {
    const body = await response.json().catch(()=>({}));
    throw new Error(body.error || `Backend returned HTTP ${response.status}.`);
  }
  return response;
}
function play(blob,signal) {
  releaseAudio(); audioUrl=URL.createObjectURL(blob);
  const audio=$('readingAudio'); audio.src=audioUrl; audio.classList.remove('hidden');
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{audio.removeEventListener('ended',done);audio.removeEventListener('error',failed);signal.removeEventListener('abort',aborted);};
    const done=()=>{cleanup();resolve();};
    const failed=()=>{cleanup();reject(new Error('Unable to play the speech audio.'));};
    const aborted=()=>{cleanup();reject(new DOMException('Stopped','AbortError'));};
    audio.addEventListener('ended',done,{once:true});audio.addEventListener('error',failed,{once:true});
    signal.addEventListener('abort',aborted,{once:true});
    if (signal.aborted) return aborted();
    audio.play().catch(error=>{
      if(error.name==='NotAllowedError') status('Press Play in the audio controls to listen.');
      else failed();
    });
  });
}

$('loadReading').addEventListener('click',async()=>{
  $('loadReading').disabled=true;
  try {
    await checkPage();
    const reply=await chrome.tabs.sendMessage(tabId,{type:'GET_READING_TEXT'});
    if(!reply?.ok) throw new Error(reply?.error || 'Refresh this page to enable reading.');
    $('readingText').value=(reply.text || '').slice(0,MAX_READING_TEXT);
    summary='';renderSummary();await saveSnapshot();
    status(reply.truncated?'Preview limited to the first 12,000 characters. Review before sharing.' :
      reply.text?`${reply.text.length} characters loaded locally. Review before sharing.`:'No readable page text was found.');
  }catch(error){status(error.message,true);}finally{controls();}
});
$('readingText').addEventListener('input',()=>{
  summary='';renderSummary();saveSnapshot().catch(()=>{});
});
$('readingConsent').addEventListener('change',()=>{
  if(!$('readingConsent').checked)stop();
  controls();
});
$('summarize').addEventListener('click',async()=>{
  if (!$('readingConsent').checked || summaryController || speechController) return;
  if (!isWorkspace) {
    try {await openWorkspace('summary');}catch(error){status(error.message,true);}
    return;
  }
  const controller=summaryController=new AbortController();
  controls(); status('Creating summary in this persistent tab...');
  try {
    await checkPage(); controller.signal.throwIfAborted();
    // The original summary is not reused after the underlying text changes.
    summary='';renderSummary();await saveSnapshot();
    const response=await request('summarize',$('readingText').value,controller.signal);
    const result=await response.json();controller.signal.throwIfAborted();
    if(typeof result.summary!=='string'||!result.summary.trim())throw new Error('No summary was returned.');
    await checkPage();controller.signal.throwIfAborted();
    summary=result.summary;renderSummary();await saveSnapshot();
    status(`Summary ready (${result.provider}). Safe to close this tab; reopen WEBBY to see it.`);
  }catch(error){status(controller.signal.aborted?'Stopped.':error.message,!controller.signal.aborted);}
  finally{summaryController=null;controls();}
});
async function speak(text,action) {
  if (!$('readingConsent').checked || speechController || summaryController || !text.trim()) return;
  if (!isWorkspace) {
    try {await openWorkspace(action);}catch(error){status(error.message,true);}
    return;
  }
  const controller=speechController=new AbortController();controls();
  try {
    const chunks=speechChunks(text);
    for(let i=0;i<chunks.length;i++){
      controller.signal.throwIfAborted();await checkPage();controller.signal.throwIfAborted();
      status(`Preparing speech ${i+1} of ${chunks.length}...`);
      const response=await request('speech',chunks[i],controller.signal);
      const blob=await response.blob();controller.signal.throwIfAborted();
      status(`Reading ${i+1} of ${chunks.length}. Use the audio controls to pause.`);
      await play(blob,controller.signal);
    }
    status('Finished reading.');
  }catch(error){status(controller.signal.aborted?'Stopped.':error.message,!controller.signal.aborted);}
  finally{releaseAudio();speechController=null;controls();}
}
$('readText').addEventListener('click',()=>speak($('readingText').value,'textSpeech'));
$('readSummary').addEventListener('click',()=>speak(summary,'summarySpeech'));
$('stopReading').addEventListener('click',stop);
$('clearReading').addEventListener('click',async()=>{
  stop();summary='';$('readingText').value='';$('readingConsent').checked=false;
  renderSummary();
  if (tabId) await chrome.storage.session.remove(sessionKey());
  status('Saved draft and summary cleared.');controls();
});
if ($('openReadingWorkspace')) $('openReadingWorkspace').addEventListener('click',()=>openWorkspace().catch(error=>status(error.message,true)));
window.addEventListener('pagehide',stop);

async function init() {
  controls();
  const requestedTab=isWorkspace?Number(query.get('tab')):null;
  let tab=isWorkspace && Number.isSafeInteger(requestedTab) && requestedTab>0?
    await chrome.tabs.get(requestedTab):(await chrome.tabs.query({active:true,currentWindow:true}))[0];
  if (!isWorkspace && tab?.url?.startsWith(chrome.runtime.getURL('reading-workspace.html'))) {
    const sourceId=Number(new URL(tab.url).searchParams.get('tab'));
    if (Number.isSafeInteger(sourceId) && sourceId>0) {
      try {tab=await chrome.tabs.get(sourceId);} catch {tab=null;}
    }
  }
  if(!tab?.id || !/^https?:\/\//.test(tab.url || '')){
    status(isWorkspace?'The original website tab is no longer available.':'Open an ordinary webpage to use reading.');return;
  }
  tabId=tab.id;pageUrl=tab.url;
  await checkPage(); available=true;
  const stored=await readSession();
  if(stored){applySnapshot(stored);status(summary?'Previous summary restored for this browser session.':'Previous reading preview restored for this browser session.');}
  controls();
  // Only a fresh, explicitly clicked popup action may automatically start a
  // provider request in the new tab. Opening the workspace alone never sends.
  const action=query.get('action');
  if(isWorkspace && ACTIONS.has(action) && stored?.requestedAction===action &&
      Date.now()-stored.requestedAt>=0 && Date.now()-stored.requestedAt<120000){
    await chrome.storage.session.set({[sessionKey()]:{...stored,requestedAction:null,requestedAt:0}});
    $('readingConsent').checked=true;controls();
    if(action==='summary')$('summarize').click();
    else if(action==='textSpeech')$('readText').click();
    else if(action==='summarySpeech')$('readSummary').click();
  }
}
// The popup can be reopened while the persistent tab is working; show its
// completed summary without requiring the user to press Load again.
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='session'||!tabId||!changes[sessionKey()]||!available)return;
  const state=changes[sessionKey()].newValue;
  if(!state){stop();summary='';$('readingText').value='';$('readingConsent').checked=false;renderSummary();return;}
  applySnapshot(state);
});
init().catch(error=>status(error.message || 'Refresh the original page to enable reading.',true));
