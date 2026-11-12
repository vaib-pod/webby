const $=id=>document.getElementById(id);
async function send(message){
  const response=await chrome.runtime.sendMessage(message);
  if(!response?.ok) throw new Error(response?.error??'WEBBY background service unavailable');
  return response.data;
}
let profile;
let analysisEntries=[];
const titles={
  overview:['Overview','Your websites. Your preferences. Your control.'],
  preferences:['Preferences','Create the default reading experience that works for you.'],
  twin:['Accessibility Twin','Transparent, explicit-feedback-based personalization.'],
  privacy:['Privacy & AI','You choose what WEBBY remembers and shares.']
};
function notify(message,error=false){
  const el=$('notice');el.textContent=message;el.className=`notice${error?' error':''}`;
  clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>el.classList.add('hidden'),6500);
}
function switchTab(tab){
  for(const button of document.querySelectorAll('[data-tab]')){
    const selected=button.dataset.tab===tab;
    button.classList.toggle('active',selected);
    if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
  for(const panel of document.querySelectorAll('.panel')) panel.classList.toggle('hidden',panel.id!==`tab-${tab}`);
  $('pageTitle').textContent=titles[tab][0];$('pageSubtitle').textContent=titles[tab][1];
  if(tab==='twin')loadTwin().catch(error=>notify(error.message,true));
  if(tab==='privacy')loadPrivacy().catch(error=>notify(error.message,true));
}
for (const button of document.querySelectorAll('[data-tab]')) button.addEventListener('click',()=>switchTab(button.dataset.tab));
for (const button of document.querySelectorAll('[data-go]')) button.addEventListener('click',()=>switchTab(button.dataset.go));
function profileToForm(data){
  $('prefEnabled').checked=data.enabled;$('prefFont').value=Math.round(data.fontScale*100);
  $('prefLine').value=Math.round(data.lineHeight*100);
  $('prefContrast').checked=data.contrastMode==='high';
  $('prefDarkMode').checked=data.darkMode===true;
  $('prefMotion').checked=data.reduceMotion;$('prefFocus').checked=data.focusAssist;
  updatePreview();
}
function formToProfile(){
  return {version:1,enabled:$('prefEnabled').checked,
    fontScale:Number($('prefFont').value)/100,lineHeight:Number($('prefLine').value)/100,
    contrastMode:$('prefContrast').checked?'high':'normal',darkMode:$('prefDarkMode').checked,
    reduceMotion:$('prefMotion').checked,focusAssist:$('prefFocus').checked};
}
function updatePreview(){
  const data=formToProfile();
  $('prefFontValue').textContent=`${Math.round(data.fontScale*100)}%`;
  $('prefLineValue').textContent=`${data.lineHeight.toFixed(2)}×`;
  $('preview').style.fontSize=`${data.fontScale*100}%`;
  $('preview').querySelector('p').style.lineHeight=String(data.lineHeight);
  $('preview').style.color=data.darkMode?'#e5e7eb':(data.contrastMode==='high'?'#111827':'#4d5b77');
  $('preview').style.background=data.darkMode?'#111827':(data.contrastMode==='high'?'#ffffff':'#f7f9fd');
  $('preview').querySelector('h3').style.color=data.darkMode?'#f8fafc':'#1c2c4c';
  $('preview').querySelector('p').style.color=data.darkMode?'#cbd5e1':(data.contrastMode==='high'?'#111827':'#4d5b77');
  $('previewLink').style.color=data.darkMode?'#93c5fd':'#265cde';
  $('previewLink').style.outline=data.focusAssist?'2px dashed #f59e0b':'none';
}
for (const id of ['prefEnabled','prefFont','prefLine','prefContrast','prefDarkMode','prefMotion','prefFocus']) $(id).addEventListener('input',updatePreview);
$('settingsForm').addEventListener('submit',async event=>{
  event.preventDefault();
  try {profile=await send({type:'SAVE_PROFILE',profile:formToProfile()});
    renderDigest(profile);notify('Global accessibility profile saved.');}
  catch(error){notify(error.message,true);}
});
function renderDigest(data){
  const fields=[['Text scale',`${Math.round(data.fontScale*100)}%`],
    ['Line spacing',`${data.lineHeight.toFixed(2)}×`],
    ['High contrast',data.contrastMode==='high'?'On':'Off'],
    ['Dark mode',data.darkMode?'On':'Off'],
    ['Reduced motion',data.reduceMotion?'On':'Off'],
    ['Keyboard focus',data.focusAssist?'On':'Off']];
  const container=$('profileDigest');container.replaceChildren();
  for(const [name,value] of fields){const item=document.createElement('div');
    const left=document.createElement('span');left.textContent=name;const right=document.createElement('strong');right.textContent=value;
    item.append(left,right);container.append(item);}
}
function textNode(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function describePatch(patch){
  const parts=[];
  if(patch.fontScale!==undefined)parts.push(`${Math.round(patch.fontScale*100)}% text`);
  if(patch.lineHeight!==undefined)parts.push(`${patch.lineHeight}× spacing`);
  if(patch.contrastMode==='high')parts.push('high contrast');
  if(patch.darkMode)parts.push('dark mode');
  if(patch.reduceMotion)parts.push('reduced motion');
  if(patch.focusAssist)parts.push('focus assist');
  if(patch.enabled===false)parts.push('paused');
  return parts.join(' · ') || 'Uses global settings';
}
async function loadTwin(){
  const [twin,overrides,history]=await Promise.all([
    send({type:'GET_TWIN'}),send({type:'LIST_SITE_OVERRIDES'}),send({type:'GET_FEEDBACK_HISTORY'})]);
  $('statSites').textContent=$('twinSites').textContent=String(twin.customizedSites);
  $('statLearned').textContent=$('twinLearned').textContent=String(twin.adjustmentsLearned);
  $('twinHistoryCount').textContent=String(history.length);
  $('statAnalyses').textContent=String(analysisEntries.length);
  const sites=$('siteList');sites.replaceChildren();
  if(!overrides.length)sites.append(textNode('div','No site customizations yet. Use the WEBBY popup to save one.','empty'));
  for(const item of overrides.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))){
    const row=textNode('div','','site-row');const details=document.createElement('div');
    details.append(textNode('strong',item.hostname),textNode('small',describePatch(item.patch)));
    const button=textNode('button','Remove','btn danger small');
    button.setAttribute('aria-label',`Remove customizations for ${item.hostname}`);
    button.addEventListener('click',async()=>{
      try{await send({type:'SAVE_SITE_OVERRIDE',override:{hostname:item.hostname,updatedAt:new Date().toISOString(),patch:{}}});
        notify(`Removed customizations for ${item.hostname}`);await loadTwin();}
      catch(error){notify(error.message,true);}
    });row.append(details,button);sites.append(row);
  }
  const feedback=$('feedbackList');feedback.replaceChildren();
  if(!history.length)feedback.append(textNode('div','No feedback yet. Feedback is only recorded when you select an adjustment.','empty'));
  for (const event of history.slice(-10).reverse()){
    const row=textNode('div','','history-row');const details=document.createElement('div');
    details.append(textNode('strong',event.kind.replaceAll('-',' ')),textNode('small',event.hostname));
    const date=textNode('span',new Date(event.timestamp).toLocaleString());row.append(details,date);feedback.append(row);
  }
}
async function loadPrivacy(){$('privacyConsent').checked=await send({type:'GET_AI_CONSENT'});}
$('refreshTwin').addEventListener('click',()=>loadTwin().catch(error=>notify(error.message,true)));
$('privacyConsent').addEventListener('change',async()=>{
  try{await send({type:'SET_AI_CONSENT',consent:$('privacyConsent').checked});
    notify($('privacyConsent').checked?'AI analysis consent enabled.':'AI analysis consent withdrawn.');}
  catch(error){notify(error.message,true);}
});
$('checkServer').addEventListener('click',async()=>{
  $('serverStatus').textContent='Checking local server…';
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4000);
  try{
    const res=await fetch('https://webby-backend.onrender.com/api/health',{signal:controller.signal});
    if(!res.ok)throw new Error('Backend returned an error');
    const json=await res.json();
    $('serverStatus').textContent=`Connected · ${json.aiConfigured?'AI key configured':'No AI key (rule-based fallback)'}`;
  }catch {$('serverStatus').textContent='Backend not reachable. Run npm run server from the project folder.';}
  finally{clearTimeout(timer);}
});
$('clearData').addEventListener('click',async()=>{
  if(!confirm('Delete ALL WEBBY local preferences, site overrides, feedback, analysis history and AI consent?'))return;
  try{await send({type:'CLEAR_ALL'});profile=await send({type:'GET_PROFILE'});
    profileToForm(profile);renderDigest(profile);await loadTwin();await loadPrivacy();
    analysisEntries=[];notify('All WEBBY local data deleted.');}
  catch(error){notify(error.message,true);}
});
async function init(){
  [profile,analysisEntries]=await Promise.all([
    send({type:'GET_PROFILE'}),send({type:'GET_ANALYSIS_HISTORY'})]);
  profileToForm(profile);renderDigest(profile);await loadTwin();await loadPrivacy();
  const hash=location.hash.slice(1);
  if(Object.hasOwn(titles,hash))switchTab(hash);
}
init().catch(error=>notify(error.message,true));
