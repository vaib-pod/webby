const $ = id => document.getElementById(id);
let hostname = '';
let tabId = null;
let baseProfile = null;
let modified = false;

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
  return {enabled:$('siteEnabled').checked,fontScale:Number($('fontScale').value)/100,
    lineHeight:Number($('lineHeight').value)/100,
    contrastMode:$('contrast').checked?'high':'normal',darkMode:$('darkMode').checked,
    reduceMotion:$('motion').checked,focusAssist:$('focus').checked};
}
function renderProfile(profile) {
  $('siteEnabled').checked=profile.enabled;
  $('fontScale').value=Math.round(profile.fontScale*100);
  $('lineHeight').value=Math.round(profile.lineHeight*100);
  $('contrast').checked=profile.contrastMode==='high';
  $('darkMode').checked=profile.darkMode===true;
  $('motion').checked=profile.reduceMotion;
  $('focus').checked=profile.focusAssist;
  updateLabels();
}
function updateLabels(){
  $('fontValue').textContent=`${$('fontScale').value}%`;
  $('lineValue').textContent=`${(Number($('lineHeight').value)/100).toFixed(2)}×`;
}
async function getActiveTab() {
  const tabs = await chrome.tabs.query({active:true,currentWindow:true});
  const tab = tabs[0];
  if (!tab?.id || !/^https?:\/\//.test(tab.url ?? '')) return null;
  return tab;
}
function disabledForSite(disabled){
  for (const element of document.querySelectorAll('#siteEnabled,#fontScale,#lineHeight,#contrast,#darkMode,#motion,#focus,#saveSite,#resetSite,#analyze,[data-feedback]')) {
    element.disabled=disabled;
  }
  $('consent').disabled=disabled;
}
async function init() {
  const tab = await getActiveTab();
  baseProfile = await send({type:'GET_PROFILE'});
  $('consent').checked=await send({type:'GET_AI_CONSENT'});
  if (!tab) {
    $('host').textContent='Unsupported browser page';
    $('statePill').textContent='Unavailable';
    $('siteDescription').textContent='Open an ordinary http(s) webpage to use WEBBY.';
    disabledForSite(true);return;
  }
  tabId=tab.id;
  hostname=new URL(tab.url).hostname.toLowerCase();
  $('host').textContent=hostname;
  const effective=await send({type:'GET_EFFECTIVE_PROFILE',hostname});
  renderProfile(effective);
  let status;
  try {const reply=await chrome.tabs.sendMessage(tabId,{type:'GET_STATUS'});status=reply?.data;}
  catch {status=null;}
  if (!status) {
    $('statePill').textContent='Refresh page';
    $('statePill').className='pill warn';
    $('siteDescription').textContent='Refresh this tab to activate the newly installed extension.';
  } else {
    $('statePill').textContent=effective.enabled?'Active':'Paused';
    $('statePill').className=`pill ${effective.enabled?'ok':'warn'}`;
    $('siteDescription').textContent=`${status.modifiedNodes} text elements adapted · ${status.category} page`;
    if (status.sensitive) {
      $('analyze').disabled=true;
      $('aiOutput').textContent='AI is disabled on pages with login/payment or other sensitive inputs.';
      $('aiOutput').classList.remove('hidden');
    }
  }
  $('aiPill').textContent=$('consent').checked?'Enabled':'Opt-in';
}

for(const id of ['fontScale','lineHeight','contrast','darkMode','motion','focus','siteEnabled']) {
  $(id).addEventListener('input',()=>{modified=true;updateLabels();});
}
$('saveSite').addEventListener('click',async()=>{
  if(!hostname)return;
  try {
    await send({type:'SAVE_SITE_OVERRIDE',override:{hostname,updatedAt:new Date().toISOString(),patch:readSettings()}});
    modified=false; notice('Settings saved for this website.');
    const effective=await send({type:'GET_EFFECTIVE_PROFILE',hostname});renderProfile(effective);
    $('statePill').textContent=effective.enabled?'Active':'Paused';
  }catch(error){notice(error.message,true);}
});
$('resetSite').addEventListener('click',async()=>{
  if(!hostname)return;
  try {
    await send({type:'RECORD_FEEDBACK',hostname,kind:'reset-this-site'});
    renderProfile(await send({type:'GET_PROFILE'})); modified=false;
    notice('Site preferences reset to your global profile.');
  }catch(error){notice(error.message,true);}
});
for(const button of document.querySelectorAll('[data-feedback]')) {
  button.addEventListener('click',async()=>{
    try {
      const kind=button.dataset.feedback;
      const result=await send({type:'RECORD_FEEDBACK',hostname,kind});
      renderProfile(result.effectiveProfile);
      notice('Your Accessibility Twin remembered this adjustment.');
    }catch(error){notice(error.message,true);}
  });
}
$('consent').addEventListener('change',async()=>{
  try {await send({type:'SET_AI_CONSENT',consent:$('consent').checked});
    $('aiPill').textContent=$('consent').checked?'Enabled':'Opt-in';
    notice($('consent').checked?'AI consent enabled. Use Analyze to submit a sanitized summary.':'AI consent withdrawn.');
  }catch(error){notice(error.message,true);}
});
$('analyze').addEventListener('click',async()=>{
  if (!$('consent').checked) {notice('Enable AI consent first.',true);return;}
  if(modified) {notice('Save your site preferences before AI analysis.',true);return;}
  $('analyze').disabled=true;
  $('analyze').textContent='Analyzing…';
  try {
    const result=await send({type:'ANALYZE_WITH_AI',tabId});
    $('aiOutput').classList.remove('hidden');
    $('aiOutput').replaceChildren();
    const title=document.createElement('strong');
    title.textContent=result.source==='ai'?'AI recommendations applied':'Rule-based fallback applied';
    $('aiOutput').append(title);
    const count=document.createElement('div');count.textContent=`${result.appliedCount} safe action(s) applied.`;
    $('aiOutput').append(count);
    for (const reason of result.reasons.slice(0,4)) {
      const line=document.createElement('div');line.textContent=`• ${reason}`;$('aiOutput').append(line);
    }
    if(result.note){const note=document.createElement('div');note.textContent=result.note;$('aiOutput').append(note);}
    notice('Analysis completed. AI suggestions are temporary until you save preferences.');
  }catch(error){notice(error.message,true);}
  finally {$('analyze').disabled=false;$('analyze').textContent='Analyze this page';}
});
$('dashboard').addEventListener('click',()=>chrome.runtime.openOptionsPage());
init().catch(error=>notice(error.message,true));
