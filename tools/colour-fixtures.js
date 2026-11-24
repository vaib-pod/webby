import {popupSetup} from './accessibility-fixtures.js';

export const colourSetup=popupSetup
  .replace("await import('/popup.js');window.popupReady=true;",`window.chrome.runtime.getURL=path=>new URL('/'+path,location.href).href;
    window.chrome.storage.local.remove=async key=>{delete store[key];};
    window.fetches=[];const localFetch=window.fetch;
    window.fetch=(url,...args)=>{fetches.push(String(url));if(new URL(url,location.href).origin!==location.origin)throw new Error('External request blocked');return localFetch(url,...args);};
    await import('/colour-vision.js');window.colourReady=true;`);

export const colourTests=`<script type="module">
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms||50));
const until=async predicate=>{for(let i=0;i<150;i++){if(predicate())return;await wait();}throw new Error('UI readiness timeout');};
const el=id=>document.getElementById(id);
const change=(id,value)=>{el(id).value=value;el(id).dispatchEvent(new Event('change',{bubbles:true}));};
const answer=value=>{el('plateAnswer').value=value;el('plateAnswer').dispatchEvent(new Event('input',{bubbles:true}));};
try{
await until(()=>window.colourReady&&!el('applyPreference').disabled);
store.webbyOverrides=[{hostname:'example.com',updatedAt:new Date().toISOString(),patch:{fontScale:1.3,darkMode:true}}];
el('selectType').click();
check(!el('manualScreen').classList.contains('hidden') && el('visionType').options.length===8,'manual path lists all seven types plus unsure');
change('visionType','achromatopsia');
check(document.querySelector('input[name="palette"]:checked').value==='graphite','manual type suggests a palette without saving the type');
document.querySelector('input[value="purple-teal"]').click();el('applyPreference').click();
await until(()=>store.webbyColourPreference?.enabled&&!el('applyPreference').disabled);
check(store.webbyColourPreference.paletteId==='purple-teal' && store.webbyColourPreference.source==='manual','user can override the suggested palette and explicitly apply it');
check(!JSON.stringify(store).includes('achromatopsia') && store.webbyOverrides[0].patch.fontScale===1.3,'no type saved and website preferences preserved');
el('openSettings').click();el('colourEnabled').click();await until(()=>store.webbyColourPreference.enabled===false&&!el('applyPreference').disabled);
check(!el('colourEnabled').checked,'settings can disable the saved adaptation');
el('colourEnabled').click();await until(()=>store.webbyColourPreference.enabled===true&&!el('applyPreference').disabled);
const restored=await chrome.runtime.sendMessage({type:'GET_ACCESSIBILITY_TWIN',hostname:'example.com'});
check(restored.data.colourPreference.paletteId==='purple-teal' && restored.data.profile.darkMode,'Twin reads saved colour preference with existing effective website profile');
el('clearPreference').click();await until(()=>!store.webbyColourPreference&&!el('clearPreference').disabled);
check(!el('colourEnabled').disabled && !el('colourEnabled').checked && store.webbyOverrides.length===1,'clear removes only colour preferences and leaves the switch usable');
document.querySelector('input[value="graphite"]').click();el('colourEnabled').click();
await until(()=>store.webbyColourPreference?.enabled&&!el('applyPreference').disabled);
check(store.webbyColourPreference.paletteId==='graphite','settings switch can enable a new preference without a previous Apply');
store.webbyColourPreference={...store.webbyColourPreference,enabled:false,paletteId:'blue-amber'};
for(const fn of storageListeners)fn({webbyColourPreference:{newValue:store.webbyColourPreference}},'local');
await until(()=>!el('colourEnabled').checked);
check(el('savedPreference').textContent.includes('Blue & amber'),'settings stay synchronized with changes in another tab');
store.webbyProfile={version:1,enabled:false,fontScale:1.1,lineHeight:1.6,contrastMode:'normal',darkMode:false,reduceMotion:false,focusAssist:true};
for(const fn of storageListeners)fn({webbyProfile:{newValue:store.webbyProfile}},'local');
await wait();el('colourEnabled').click();await until(()=>store.webbyColourPreference.enabled&&!el('applyPreference').disabled);
check(el('applicationStatus').textContent.includes('paused')&&el('message').textContent.includes('paused'),'settings explain when the global profile prevents the saved palette applying');
store.webbyProfile.enabled=true;for(const fn of storageListeners)fn({webbyProfile:{newValue:store.webbyProfile}},'local');await wait();
el('backToPaths').click();el('startAssessment').click();
await until(()=>el('questionProgress').textContent==='Question 1 of 10');
await until(()=>el('plateImage').complete&&el('plateImage').naturalWidth>0);
check(el('plateImage').src.includes('/assets/colourblind/plate-01.png'),'activity loads plates through extension-local manifest paths');
let untouched=true;for(let node=el('plateImage');node;node=node.parentElement){const css=getComputedStyle(node);if(css.filter!=='none'||css.opacity!=='1')untouched=false;}
check(untouched && getComputedStyle(el('plateImage')).objectFit==='contain','assessment plate has no filters, opacity changes or cropping');
el('reviewAnswers').click();check(el('submitAssessment').disabled,'blank answers cannot be submitted');el('returnToQuestion').click();
answer('abc');el('reviewAnswers').click();check(el('submitAssessment').disabled,'invalid numeric input cannot be submitted');el('returnToQuestion').click();
answer('12');el('nextQuestion').click();el('unableAnswer').click();el('previousQuestion').click();
check(el('plateAnswer').value==='12','Previous preserves the numeric answer');el('nextQuestion').click();
check(el('unableAnswer').getAttribute('aria-pressed')==='true','Next preserves the unable-to-identify choice');
answer('99');el('nextQuestion').click();
const remaining=['unable','5','3','15','6','45','73','26'];
for(const value of remaining){if(value==='unable')el('unableAnswer').click();else answer(value);el('nextQuestion').click();}
check(!el('reviewScreen').classList.contains('hidden') && el('answerReview').children.length===10 && !el('submitAssessment').disabled,'all answered plates can be reviewed before submission');
el('answerReview').children[0].querySelector('button').click();check(el('plateAnswer').value==='12','review links return to the retained answer');el('reviewAnswers').click();el('submitAssessment').click();
check(!el('resultsScreen').classList.contains('hidden') && el('resultSummary').textContent.includes('possible difficulty'),'mixed results give non-diagnostic screening summary');
check([...el('resultCounts').querySelectorAll('dd')].map(x=>x.textContent).join(',')==='10,10,8,1,1,0','results display total, scored, correct, incorrect, unable and unscored counts');
check(el('plateAnswer').value==='' && !el('answerReview').children.length && !el('plateImage').hasAttribute('src'),'individual answers and image reference are discarded after scoring');
el('previewAdaptations').click();check(document.activeElement===el('paletteTitle'),'Preview Adaptations moves keyboard focus to palette comparison');
document.querySelector('input[value="graphite"]').click();el('applyPreference').click();await until(()=>store.webbyColourPreference?.paletteId==='graphite');
check(store.webbyColourPreference.source==='activity' && !JSON.stringify(store).match(/plate-|answers|correct|diagnosis/),'results save only the user-confirmed palette and provenance');
el('retakeAssessment').click();await until(()=>el('questionProgress').textContent==='Question 1 of 10');check(el('plateAnswer').value==='','retaking starts with empty answers');
check(fetches.every(url=>new URL(url).pathname.startsWith('/assets/colourblind/')),'assessment requests only local manifest and images, with no backend or external APIs');
// Missing keys must not silently turn into a successful or clinical result.
el('backToPaths').click();const realFetch=window.fetch;
window.fetch=async(url,...args)=>{const response=await realFetch(url,...args);if(String(url).endsWith('plates.json')){const data=await response.json();for(const plate of data.plates){plate.scored=false;plate.verification='unverified';plate.expectedAnswers=[];}return new Response(JSON.stringify(data));}return response;};
el('startAssessment').click();await until(()=>el('questionProgress').textContent==='Question 1 of 10');el('reviewAnswers').click();
check(el('submitAssessment').disabled && el('reviewStatus').textContent.includes('verified answer key'),'unverified manifests allow exploration but block scoring');
window.fetch=async(url,...args)=>{const response=await realFetch(url,...args);if(String(url).endsWith('plates.json')){const data=await response.json();data.plates[0].sha256='0'.repeat(64);return new Response(JSON.stringify(data));}return response;};
el('backToPaths').click();el('startAssessment').click();await until(()=>el('questionProgress').textContent==='Question 1 of 10');
for(const value of ['12','8','29','5','3','15','6','45','73','26']){answer(value);el('nextQuestion').click();}
check(el('submitAssessment').disabled && el('reviewStatus').textContent.includes('checksums'),'replaced images invalidate scoring until their key is reverified');
}catch(error){check(false,'Colour UI exception: '+error.stack);}
const pre=document.createElement('pre');pre.id='browser-results';pre.textContent=JSON.stringify(results);document.body.append(pre);
</script>`;

export const colourAdaptationFixture=`<!doctype html><html><head><link rel="stylesheet" href="/content.css"></head><body style="background:#fff;color:#111">
<p id="low" style="color:#aaa">Low contrast text and <a id="link" style="color:#aaa;text-decoration:none" href="#low">Original prose link</a></p>
<form role="search"><input aria-label="Search" name="q"><button id="searchSubmit" style="background:#dddddd;color:#111111">Search</button><a id="searchLink" href="/search" style="text-decoration:none">Search UI link</a></form>
<nav><a id="navLink" href="/home" style="text-decoration:none">Main navigation</a></nav>
<style>
  #resultLink:link { color:rgb(0,70,180); }
  #resultLink:visited { color:rgb(100,40,140); }
  #resultLink h3 { color:inherit; }
  #resultLink.page-hover { color:rgb(0,90,70); }
</style>
<div class="search-results"><a id="resultLink" href="/unopened-result" style="text-decoration:none"><h3 id="resultTitle">Unopened search result</h3></a></div>
<button id="control" style="background:#b00;color:#fff"><span style="color:#ddd">Original button</span></button>
<form><button type="button" id="formControl" style="background:#b00;color:#fff"><svg width="16" height="16"><rect width="16" height="16" fill="currentColor"/></svg><span>Save changes</span></button></form>
<div id="warning" role="alert" style="background:#ffaaaa;color:#aaa"><p>Original warning text</p></div>
<button id="selected" aria-pressed="false">Selection</button>
<img id="media" width="40" height="40" src="/assets/icon48.png"><canvas id="canvas"></canvas><svg id="art" width="30" height="30"><rect width="30" height="30" fill="red"/></svg>
<div id="series" data-webby-chart-series="1" aria-label="South, 50" style="height:20px;width:100px;background:red"></div>
<div data-webby-exclude><a id="excluded" href="#" style="color:red;text-decoration:none">Excluded</a></div>
<script type="module">
import {PALETTES} from '/shared/colour.js';
window.results=[];window.check=(ok,name)=>results.push({ok:Boolean(ok),name});
const el=id=>document.getElementById(id),wait=()=>new Promise(resolve=>setTimeout(resolve,550));
const original=new Map(['low','link','control','warning','series','media','canvas','art','excluded','searchSubmit','searchLink','navLink','resultLink'].map(id=>[id,el(id).getAttribute('style')||'']));
const styleState=node=>JSON.stringify([...node.style].sort().map(name=>[name,node.style.getPropertyValue(name),node.style.getPropertyPriority(name)]));
const originalProperties=new Map();
let clicks=0;el('control').addEventListener('click',()=>clicks++);
let profile={version:1,enabled:true,fontScale:1,lineHeight:1.6,contrastMode:'normal',darkMode:false,reduceMotion:false,focusAssist:true};
let colour={preference:{version:1,enabled:false,userConfirmed:true,paletteId:'blue-amber',source:'manual'},palette:PALETTES[0]};
const listeners=[],storageListeners=[];
window.chrome={runtime:{id:'test',onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:(message,callback)=>callback({ok:true,data:message.type==='GET_COLOUR_CONTEXT'?colour:message.type==='GET_READING_TOOLS'?{readingRuler:false}:profile})},storage:{onChanged:{addListener:fn=>storageListeners.push(fn)}}};
const message=(type)=>new Promise(resolve=>{for(const fn of listeners)fn({type},{id:'test'},resolve);});
try{
await import('/colour-content.js');await import('/content.js');await wait();
// Baseline includes existing reading settings; disabling colour must preserve them.
for(const id of original.keys()){original.set(id,el(id).getAttribute('style')||'');originalProperties.set(id,styleState(el(id)));}
colour.preference.enabled=true;await message('PROFILE_UPDATED');
check(getComputedStyle(el('link')).textDecorationLine==='underline' && getComputedStyle(el('link')).color==='rgb(170, 170, 170)','colour adaptation underlines prose links while retaining their original colour');
check(['searchLink','navLink','resultLink'].every(id=>getComputedStyle(el(id)).textDecorationLine==='none'),'search result headings and navigation links do not receive forced underlines');
check(getComputedStyle(el('searchSubmit')).backgroundColor==='rgb(221, 221, 221)','search form controls do not get overwritten by the palette');
for(const palette of PALETTES){
  colour={...colour,preference:{...colour.preference,paletteId:palette.id},palette};await message('PROFILE_UPDATED');
  check(getComputedStyle(el('resultLink')).color==='rgb(0, 70, 180)' && getComputedStyle(el('resultTitle')).color==='rgb(0, 70, 180)' &&
    !el('resultLink').style.getPropertyValue('color') && !el('resultTitle').style.getPropertyValue('color'),
    palette.name+' preserves unopened link colours and nested search titles without overriding link-state CSS');
}
el('resultLink').classList.add('page-hover');await wait();
check(getComputedStyle(el('resultTitle')).color==='rgb(0, 90, 70)','website link-state styling can still change after adaptation');
el('resultLink').classList.remove('page-hover');colour={...colour,preference:{...colour.preference,paletteId:'blue-amber'},palette:PALETTES[0]};await message('PROFILE_UPDATED');
check(getComputedStyle(el('low')).color==='rgb(15, 23, 42)','colour adaptation repairs low-contrast text on known backgrounds');
check(getComputedStyle(el('control')).backgroundColor==='rgb(23, 79, 135)' && getComputedStyle(el('control').firstChild).color==='rgb(255, 255, 255)','buttons retain readable text with chosen action colours');
check(getComputedStyle(el('formControl')).backgroundColor==='rgb(23, 79, 135)' && getComputedStyle(el('formControl').querySelector('svg')).color==='rgb(255, 255, 255)','ordinary form buttons adapt even when they contain icons');
el('control').click();check(clicks===1,'adaptation preserves original event handlers');
check(el('warning').textContent==='Original warning text' && el('warning').getAttribute('role')==='alert' && getComputedStyle(el('warning')).borderInlineStartStyle==='double','warnings retain semantic role and text with a non-colour cue');
check(getComputedStyle(el('warning').firstChild).color==='rgb(23, 40, 59)','nested warning text keeps contrast against the adapted surface');
check(getComputedStyle(el('series')).backgroundImage.includes('repeating-linear-gradient'),'explicit labelled HTML chart series receive patterns');
check(['media','canvas','art','excluded'].every(id=>(el(id).getAttribute('style')||'')===original.get(id)),'photos, canvas, SVG artwork and excluded content are untouched');
el('selected').setAttribute('aria-pressed','true');await wait();check(getComputedStyle(el('selected')).outlineStyle==='double','dynamic selected state receives an outline');
const dynamic=document.createElement('a');dynamic.href='#';dynamic.textContent='New prose link';const dynamicParagraph=document.createElement('p');dynamicParagraph.append(dynamic);document.body.append(dynamicParagraph);await wait();
check(getComputedStyle(dynamic).textDecorationLine==='underline','dynamic page additions receive colour support');
profile={...profile,darkMode:true};await message('PROFILE_UPDATED');
check(document.documentElement.getAttribute('data-webby-dark-mode')==='1' && getComputedStyle(el('link')).textDecorationLine==='underline' && getComputedStyle(el('control')).backgroundColor==='rgb(23, 79, 135)','Dark Mode stays enabled while the chosen palette also applies');
profile={...profile,darkMode:false,contrastMode:'high',reduceMotion:true};await message('PROFILE_UPDATED');
check(document.documentElement.getAttribute('data-webby-reduce-motion')==='1' && getComputedStyle(el('link')).textDecorationLine==='underline','colour support coexists with high contrast and reduced motion');
check(getComputedStyle(el('link')).color==='rgb(170, 170, 170)' && !el('resultTitle').style.getPropertyValue('color'),'high contrast retains website-owned link-state colours');
profile={...profile,contrastMode:'normal',reduceMotion:false};colour.preference.enabled=false;await message('PROFILE_UPDATED');
const unrestored=[...originalProperties].filter(([id,state])=>styleState(el(id))!==state).map(([id,state])=>({id,before:state,after:styleState(el(id))}));
check(!unrestored.length,'disabling colour support restores original inline styles and priorities'+(unrestored.length?' '+JSON.stringify(unrestored):''));
check(!document.documentElement.hasAttribute('data-webby-colour'),'disabling removes colour focus rules');
colour.preference.enabled=true;await message('PROFILE_UPDATED');profile.enabled=false;await message('PROFILE_UPDATED');
check(!document.documentElement.hasAttribute('data-webby-colour') && getComputedStyle(el('link')).textDecorationLine==='none','global pause also restores colour adaptations');
profile.enabled=true;document.documentElement.setAttribute('data-webby-assessment','');await message('PROFILE_UPDATED');
check(!document.documentElement.hasAttribute('data-webby-colour') && getComputedStyle(el('link')).textDecorationLine==='none','assessment documents explicitly suspend colour adaptations');
}catch(error){check(false,'Colour adaptation exception: '+error.stack);}
const pre=document.createElement('pre');pre.id='browser-results';pre.textContent=JSON.stringify(results);document.body.append(pre);
</script></body></html>`;
