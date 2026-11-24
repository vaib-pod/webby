import {PRESETS, matchingPreset} from './shared/presets.js';
const $ = id => document.getElementById(id);
let hostname = '';
let tabId = null;
let profileEnabled = true;
let tabReady = false;
let presetBusy = false;
let readerActive = false;
let pageSensitive = false;

function renderPreset() {
  const preset = matchingPreset(readSettings());
  $('presetState').textContent = preset?.name || 'Custom';
  for (const button of document.querySelectorAll('[data-preset]')) {
    button.setAttribute('aria-pressed', String(button.dataset.preset === preset?.id));
  }
}
function renderTools(status) {
  readerActive = status.focusReading === true;
  pageSensitive = status.sensitive === true;
  $('focusReading').querySelector('small').textContent = readerActive ? 'Exit text-only view' : 'Text-only view';
  $('focusReading').setAttribute('aria-pressed', String(readerActive));
  $('focusReading').disabled = !tabReady || (pageSensitive && !readerActive);
  $('readingRuler').checked = status.readingRuler === true;
  $('readingRuler').disabled = !tabReady;
  $('toolsStatus').textContent = pageSensitive ? 'Focus Reading Mode is unavailable on sensitive pages.' : 'Local reading tools. No content is uploaded.';
}
async function tabMessage(message) {
  const tab = await chrome.tabs.get(tabId);
  if (new URL(tab.url).hostname.toLowerCase() !== hostname) throw new Error('The tab changed. Reopen WEBBY.');
  const reply = await chrome.tabs.sendMessage(tabId,message);
  if (!reply?.ok) throw new Error(reply?.error || 'Refresh this page to activate WEBBY.');
  return reply;
}

async function send(message) {
  const reply = await chrome.runtime.sendMessage(message);
  if (!reply?.ok) throw new Error(reply?.error || 'WEBBY service unavailable');
  return reply.data;
}
function notice(message,isError=false) {
  $('notice').textContent = message;
  $('notice').className = `status ${isError ? 'error':'success'}`;
}
function readSettings() {
  return {enabled:profileEnabled,fontScale:Number($('fontScale').value)/100,
    lineHeight:Number($('lineHeight').value)/100,
    contrastMode:$('contrast').checked?'high':'normal',darkMode:$('darkMode').getAttribute('aria-pressed')==='true',
    reduceMotion:$('motion').checked,focusAssist:$('focus').checked};
}
function renderProfile(profile) {
  profileEnabled=profile.enabled;
  $('fontScale').value=Math.round(profile.fontScale*100);
  $('lineHeight').value=Math.round(profile.lineHeight*100);
  $('contrast').checked=profile.contrastMode==='high';
  $('darkMode').setAttribute('aria-pressed',String(profile.darkMode===true));
  $('motion').checked=profile.reduceMotion;
  $('focus').checked=profile.focusAssist;
  updateLabels();
  renderPreset();
}
function updateLabels(){
  $('fontValue').textContent=`${$('fontScale').value}%`;
  $('lineValue').textContent=`${(Number($('lineHeight').value)/100).toFixed(2)}×`;
}
async function getActiveTab() {
  const tabs = await chrome.tabs.query({active:true,currentWindow:true});
  let tab = tabs[0];
  // A user may reopen the popup while WEBBY's persistent reader tab is active.
  // Continue to control the original website rather than reporting Unavailable.
  if (tab?.url?.startsWith(chrome.runtime.getURL('reading-workspace.html'))) {
    const sourceId=Number(new URL(tab.url).searchParams.get('tab'));
    if(Number.isSafeInteger(sourceId)&&sourceId>0) {
      try {tab=await chrome.tabs.get(sourceId);} catch {return null;}
    }
  }
  if (!tab?.id || !/^https?:\/\//.test(tab.url ?? '')) return null;
  return tab;
}
function disabledForSite(disabled){
  for (const element of document.querySelectorAll('#fontScale,#lineHeight,#contrast,#darkMode,#motion,#focus,#saveSite,#resetSite,#focusReading,#readingRuler,[data-preset]')) {
    element.disabled=disabled;
  }
}
async function init() {
  const tab = await getActiveTab();
  if (!tab) {
    $('statePill').textContent='Unavailable';
    notice('Open an ordinary http(s) webpage to use WEBBY.');
    disabledForSite(true);return;
  }
  tabId=tab.id;
  hostname=new URL(tab.url).hostname.toLowerCase();
  const effective=await send({type:'GET_EFFECTIVE_PROFILE',hostname});
  renderProfile(effective);
  let status;
  try {const reply=await chrome.tabs.sendMessage(tabId,{type:'GET_STATUS'});status=reply?.data;}
  catch {status=null;}
  if (!status) {
    $('statePill').textContent='Refresh page';
    $('statePill').className='pill warn';
    notice('Refresh this tab to activate the newly installed extension.');
    disabledForSite(true);
    $('toolsStatus').textContent='Refresh this page to activate reading tools.';
  } else {
    tabReady = true;
    $('darkMode').disabled = false;
    renderTools(status);
    for (const button of document.querySelectorAll('[data-preset]')) button.disabled = false;
    $('statePill').textContent='Ready';
    $('statePill').className='pill ok';
  }
}

for(const id of ['fontScale','lineHeight','contrast','motion','focus']) {
  $(id).addEventListener('input',()=>{profileEnabled=true;updateLabels();renderPreset();});
}
async function applyMode(patch,successMessage) {
    if (!hostname || !tabReady || presetBusy) return;
    presetBusy = true;
    disabledForSite(true);
    try {
      await tabMessage({type:'GET_STATUS'});
      await send({type:'SAVE_SITE_OVERRIDE',override:{hostname,updatedAt:new Date().toISOString(),patch}});
      // Ensure the active tab updates even when Chrome withholds URLs for other tabs.
      await tabMessage({type:'PROFILE_UPDATED'});
      renderProfile(await send({type:'GET_EFFECTIVE_PROFILE',hostname}));
      
      $('statePill').textContent='Ready';
      notice(successMessage);
    } catch(error) {notice(error.message,true);}
    finally {
      presetBusy = false; disabledForSite(false);
      try {renderTools((await tabMessage({type:'GET_STATUS'})).data);} catch {tabReady=false;disabledForSite(true);}
    }
}
for (const button of document.querySelectorAll('[data-preset]')) {
  button.addEventListener('click',()=>{
    const preset = PRESETS.find(item => item.id === button.dataset.preset);
    if (preset) applyMode(preset.patch,`${preset.name} applied successfully.`);
  });
}
$('darkMode').addEventListener('click',()=>{
  const darkMode = $('darkMode').getAttribute('aria-pressed') !== 'true';
  applyMode({...readSettings(),enabled:true,darkMode},darkMode ? 'Dark Mode enabled for this website.' : 'Dark Mode turned off.');
});
$('focusReading').addEventListener('click',async()=>{
  $('focusReading').disabled=true;
  try {
    const reply = await tabMessage({type:'SET_FOCUS_READING',enabled:!readerActive});
    renderTools(reply.data);
    notice(readerActive ? 'Focus Reading Mode opened. Press Escape or Exit Reading Mode to return.' : 'Original page restored.');
  } catch(error) {notice(error.message,true);}
  finally {$('focusReading').disabled=!tabReady || (pageSensitive && !readerActive);}
});
$('readingRuler').addEventListener('change',async()=>{
  const enabled = $('readingRuler').checked;
  $('readingRuler').disabled=true;
  try {
    await tabMessage({type:'GET_STATUS'});
    await send({type:'SAVE_READING_TOOLS',hostname,state:{readingRuler:enabled}});
    await tabMessage({type:'READING_TOOLS_UPDATED'});
    renderTools((await tabMessage({type:'GET_STATUS'})).data);
    notice(enabled ? 'Reading Ruler enabled for this website.' : 'Reading Ruler turned off.');
  } catch(error) {$('readingRuler').checked=!enabled;notice(error.message,true);}
  finally {$('readingRuler').disabled=!tabReady;}
});
$('saveSite').addEventListener('click',async()=>{
  if(!hostname)return;
  try {
    await send({type:'SAVE_SITE_OVERRIDE',override:{hostname,updatedAt:new Date().toISOString(),patch:{...readSettings(),enabled:true}}});
     notice('Settings saved for this website.');
    const effective=await send({type:'GET_EFFECTIVE_PROFILE',hostname});renderProfile(effective);
    $('statePill').textContent='Ready';
  }catch(error){notice(error.message,true);}
});
$('resetSite').addEventListener('click',async()=>{
  if(!hostname)return;
  try {
    await send({type:'SAVE_SITE_OVERRIDE',override:{hostname,updatedAt:new Date().toISOString(),patch:{}}});
    renderProfile(await send({type:'GET_PROFILE'})); 
    await tabMessage({type:'PROFILE_UPDATED'});
    notice('Site preferences reset to your global profile.');
  }catch(error){notice(error.message,true);}
});
$('dashboard').addEventListener('click',()=>chrome.runtime.openOptionsPage());
$('colourVision').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('colour-vision.html')}).catch(error=>notice(error.message,true)));
init().catch(error=>notice(error.message,true));
// Update the popup after Exit/Escape in the page and changes in another window.
chrome.runtime.onMessage.addListener((message,sender) => {
  if (sender.id === chrome.runtime.id && sender.tab?.id === tabId && message.type === 'READING_TOOLS_STATE') renderTools(message.data);
});
