// Browser fixtures exercise the real content/popup/storage code, with no APIs or keys.
export const toolsFixture = `<!doctype html><link rel="stylesheet" href="/content.css">
<button id="returnFocus">Original control</button>
<article id="original"><h1>Readable article</h1><p>${'A comfortable reading experience preserves useful information and lets readers choose their own settings. '.repeat(6)}</p>
<h2 id="details">Details</h2><ul><li>First useful point</li><li>Second point</li></ul>
<p><a href="#details">Jump to details</a> <a href="https://example.com/documentation" onclick="window.readerExploit=true">Useful external link</a>
<a href="javascript:window.readerExploit=true">Unsafe link</a></p>
<pre>const answer = 42;</pre><form><p>SECRET form</p><input value="SECRET"></form>
<aside>SECRET sidebar</aside><nav>SECRET navigation</nav><div class="advertisement">SECRET advert</div>
<p hidden>SECRET hidden</p><div contenteditable>SECRET editor</div><iframe src="about:blank"></iframe>
${'<p>A further paragraph for checking reading position and scrolling.</p>'.repeat(30)}</article>
<script>
window.results=[];window.check=(ok,name)=>results.push({ok:Boolean(ok),name});
console.warn=(...args)=>check(false,args.map(String).join(' '));
window.profile={version:1,enabled:false,fontScale:1.1,lineHeight:1.6,contrastMode:'normal',darkMode:false,reduceMotion:false,focusAssist:true};
window.toolSettings={readingRuler:false};window.listeners=[];window.storageListeners=[];
window.chrome={runtime:{id:'test',onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:(message,callback)=>{
  callback({ok:true,data:message.type==='GET_READING_TOOLS'?toolSettings:profile});}},
  storage:{onChanged:{addListener:fn=>storageListeners.push(fn)}}};
window.message=(type,extra={})=>new Promise(resolve=>{for(const fn of listeners)fn({type,...extra},{id:'test'},resolve);});
window.wait=()=>new Promise(resolve=>setTimeout(resolve,100));
</script><script src="/content.js"></script><script type="module">
try {
await wait();
const sizingStyle=document.createElement('style');
sizingStyle.textContent='#sizing-fixture p {font-size:20px;transition:font-size .2s linear} #sizing-fixture a {font-size:1em;transition:all .2s linear}';
document.head.append(sizingStyle);
const sizingFixture=document.createElement('section');sizingFixture.id='sizing-fixture';
sizingFixture.innerHTML='<p>Repeated preset <a href="#">nested text</a></p>';
document.body.append(sizingFixture);
const sizingNodes=[...sizingFixture.querySelectorAll('p,a')];
const sizes=()=>sizingNodes.map(el=>parseFloat(getComputedStyle(el).fontSize));
const atSize=expected=>sizes().every(size=>Math.abs(size-expected)<.05);
check(atSize(20),'font fixture starts at the original size');
profile={...profile,enabled:true,fontScale:1.15,lineHeight:1.75,reduceMotion:true};
const repeatedSizes=[];
for(let click=0;click<6;click++){
  // A preset save triggers both the background refresh and popup acknowledgement.
  await message('PROFILE_UPDATED');await message('PROFILE_UPDATED');await wait();
  repeatedSizes.push(sizes());
}
check(repeatedSizes.every(values=>values.every(size=>Math.abs(size-23)<.05)),
  'repeated Calm Mode applications keep text at 115%, including nested links ('+JSON.stringify(repeatedSizes)+')');
for(const [scale,line,motion,expected] of [[1.2,1.8,false,24],[1.45,1.9,true,29],[1.15,1.75,true,23]]){
  profile={...profile,fontScale:scale,lineHeight:line,reduceMotion:motion};
  await message('PROFILE_UPDATED');await wait();
  check(atSize(expected),'switching presets scales original text to '+expected+'px');
}
const addedText=document.createElement('span');addedText.textContent='Dynamic content';sizingNodes[0].append(addedText);
await new Promise(resolve=>setTimeout(resolve,500));
check(atSize(23),'dynamic content reapplication does not compound text size');
sizingStyle.textContent+='#sizing-fixture p {font-size:24px}';
await message('PROFILE_UPDATED');await wait();
check(atSize(27.6),'reapplication picks up updated page CSS instead of caching stale font sizes');
profile={...profile,enabled:false};await message('PROFILE_UPDATED');
await new Promise(resolve=>setTimeout(resolve,250));
check(atSize(24),'pausing restores current page text size after repeated preset applications');
check(getComputedStyle(sizingNodes[0]).transitionDuration==='0.2s' && !document.documentElement.hasAttribute('data-webby-updating'),
  'pausing restores page transitions and removes temporary measurement styles');
sizingFixture.remove();sizingStyle.remove();
toolSettings.readingRuler=true;await message('READING_TOOLS_UPDATED');await wait();
let ruler=document.querySelector('[data-webby-ruler]');
check(ruler && getComputedStyle(ruler).pointerEvents==='none','ruler never blocks clicks or selection');
check(getComputedStyle(ruler).height==='56px','ruler has a 56px band');
document.dispatchEvent(new PointerEvent('pointermove',{clientY:220}));await wait();
check(ruler.style.transform==='translateY(192px)','ruler follows pointer with animation-frame updates ('+ruler.style.transform+', viewport '+innerHeight+')');
document.getElementById('returnFocus').focus();await wait();
check(ruler.style.transform!=='translateY(192px)','ruler follows keyboard focus');
toolSettings.readingRuler=false;await message('READING_TOOLS_UPDATED');
const oldTransform=ruler.style.transform;
document.dispatchEvent(new PointerEvent('pointermove',{clientY:300}));await wait();
check(!document.querySelector('[data-webby-ruler]') && ruler.style.transform===oldTransform,'disabling ruler removes overlay and listeners');
toolSettings.readingRuler=true;await message('READING_TOOLS_UPDATED');
await message('READING_TOOLS_UPDATED');
check(document.querySelectorAll('[data-webby-ruler]').length===1,'preference reload restores one ruler without duplicates');
window.scrollTo(0,160);await wait();
document.dispatchEvent(new PointerEvent('pointermove',{clientY:220}));await wait();
check(document.querySelector('[data-webby-ruler]').getBoundingClientRect().top===192,'ruler stays at viewport coordinates on a scrolled page');
const source=document.getElementById('original');const originalHTML=source.outerHTML;
const oldY=scrollY;document.getElementById('returnFocus').focus({preventScroll:true});
const opened=await message('SET_FOCUS_READING',{enabled:true});
let host=document.querySelector('[data-webby-reader]');let shadow=host?.shadowRoot;
check(opened.ok && shadow?.querySelector('dialog').open,'reader opens a native modal in an isolated shadow tree');
check(shadow?.querySelectorAll('h1,h2,ul,li,pre').length===6,'reader preserves headings, lists and documentation code');
check(!shadow?.querySelector('article').textContent.includes('SECRET'),'reader excludes forms, hidden text, editors, adverts and navigation');
check(!shadow?.querySelector('article').querySelector('iframe,script,img,form,input,[onclick]'),'reader copies no embedded content or event handlers');
check(!shadow?.querySelector('a[href^="javascript:"]') && !window.readerExploit,'executable links are stripped');
check(shadow?.querySelector('a[href^="https:"]').rel==='noopener noreferrer','external links are safely preserved');
const internal=shadow.querySelector('a[href^="#"]');internal.click();
check(shadow.activeElement===shadow.querySelector('h2'),'internal links navigate and focus the copied heading');
const exit=shadow.querySelector('button');exit.focus();
exit.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true,composed:true}));
check(shadow.activeElement===shadow.querySelectorAll('a[href]')[1],'Shift+Tab wraps inside the reader');
shadow.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true,composed:true}));
check(shadow.activeElement===exit,'Tab wraps to Exit instead of background controls');
check((await message('GET_STATUS')).data.focusReading===true,'current-tab status reports the active reader');
check((await message('GET_READING_TEXT')).text.includes('A comfortable reading experience'),'summary text extraction remains available during reader mode');
exit.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true,composed:true}));
check(!document.querySelector('[data-webby-reader]') && source.outerHTML===originalHTML,'Escape removes reader and preserves original DOM');
check(document.activeElement.id==='returnFocus' && scrollY===oldY,'exit restores original keyboard focus and scroll position');
await message('SET_FOCUS_READING',{enabled:true});
const calmSurface=document.createElement('section');
calmSurface.style.cssText='background-color:rgb(255,255,255);color:rgb(25,25,25)';
calmSurface.innerHTML='<p>Comfortable warm reading.</p><button style="background:#184b25;color:white">Keep contrast</button>';
document.body.append(calmSurface);
const originalSurface=calmSurface.getAttribute('style');
profile={...profile,enabled:true,fontScale:1.15,lineHeight:1.75,contrastMode:'normal',darkMode:false,reduceMotion:true};
await message('PROFILE_UPDATED');
await wait();
check(getComputedStyle(calmSurface).backgroundColor==='rgb(251, 244, 232)' && getComputedStyle(calmSurface).color==='rgb(81, 72, 62)','Calm Mode warms neutral surfaces and keeps readable brown text ('+getComputedStyle(calmSurface).backgroundColor+', '+getComputedStyle(calmSurface).color+')');
check(getComputedStyle(calmSurface.querySelector('button')).backgroundColor==='rgb(24, 75, 37)' && getComputedStyle(calmSurface.querySelector('button')).color==='rgb(255, 255, 255)','Calm Mode preserves colored controls and their text contrast');
shadow=document.querySelector('[data-webby-reader]').shadowRoot;
check(getComputedStyle(shadow.querySelector('article')).backgroundColor==='rgb(251, 244, 232)','Calm Mode also warms the open focus reader');
check(getComputedStyle(document.querySelector('[data-webby-ruler]')).backgroundColor==='rgba(245, 202, 94, 0.22)','Calm Mode uses a softer golden reading highlight');
profile={...profile,enabled:false};await message('PROFILE_UPDATED');
check(calmSurface.getAttribute('style')===originalSurface && !document.documentElement.hasAttribute('data-webby-calm'),'pausing restores original page colors and removes Calm Mode');
profile={...profile,enabled:true};await message('PROFILE_UPDATED');
profile={...profile,enabled:true,fontScale:1.45,lineHeight:1.9,contrastMode:'high',darkMode:true,reduceMotion:true};
await message('PROFILE_UPDATED');
check(calmSurface.getAttribute('style')===originalSurface && document.documentElement.getAttribute('data-webby-calm')==='0','switching presets removes the warm page palette');
calmSurface.remove();
shadow=document.querySelector('[data-webby-reader]').shadowRoot;
check(getComputedStyle(shadow.querySelector('article')).fontSize==='29px','reader respects updated text scaling');
check(shadow.querySelector('dialog').style.getPropertyValue('--reader-ink')==='#ffffff','reader respects dark and high-contrast settings');
check(document.querySelector('[data-webby-ruler]').matches(':popover-open'),'ruler stays in the top layer with dark mode and reader');
document.dispatchEvent(new PointerEvent('pointermove',{clientY:220}));await wait();
check(document.querySelector('[data-webby-ruler]').getBoundingClientRect().top===192,'dark-mode filter does not shift ruler coordinates');
shadow.querySelector('button').click();
check(!(await message('GET_STATUS')).data.focusReading,'visible Exit button closes reader');
const password=document.createElement('input');password.type='password';document.body.append(password);
check(!(await message('SET_FOCUS_READING',{enabled:true})).ok,'sensitive pages reject reader activation');password.remove();
source.remove();
check(!(await message('SET_FOCUS_READING',{enabled:true})).ok && !document.querySelector('[data-webby-reader]'),'missing article reports failure without adding an overlay');
const hidden=document.createElement('div');hidden.style.opacity='0';hidden.append(source);document.body.append(hidden);
check(!(await message('SET_FOCUS_READING',{enabled:true})).ok,'article hidden by an ancestor is not extracted');hidden.remove();
toolSettings.readingRuler=false;await message('READING_TOOLS_UPDATED');
} catch(error) {check(false,'Unexpected browser exception: '+error.message);}
const pre=document.createElement('pre');pre.id='browser-results';pre.textContent=JSON.stringify(results);document.body.append(pre);
</script>`;

export const restoredFixture = `<!doctype html><link rel="stylesheet" href="/content.css"><p>Restored website</p>
<script>
window.listeners=[];
window.chrome={runtime:{id:'test',onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:(message,callback)=>{
  callback({ok:true,data:message.type==='GET_READING_TOOLS'?{readingRuler:true}:{enabled:false}});}},
  storage:{onChanged:{addListener(){}}}};
</script><script src="/content.js"></script><script type="module">
await new Promise(resolve=>setTimeout(resolve,100));
let state;for(const fn of listeners)fn({type:'GET_STATUS'},{id:'test'},reply=>state=reply.data);
const pre=document.createElement('pre');pre.id='browser-results';pre.textContent=JSON.stringify([
{name:'new document automatically restores saved ruler preference',ok:state?.readingRuler===true && Boolean(document.querySelector('[data-webby-ruler]'))},
{name:'focus reader is tab-local and does not automatically open on refresh',ok:state?.focusReading===false}
]);document.body.append(pre);
</script>`;

export const popupSetup = `<script>
window.results=[];window.check=(ok,name)=>results.push({ok:Boolean(ok),name});
window.store={};window.routes=[];window.storageListeners=[];
window.tabState={sensitive:false,readingRuler:false,focusReading:false};
window.chrome={runtime:{id:'test',getURL:path=>new URL('/'+path,location.href).href,onMessage:{addListener:fn=>routes.push(fn)},onInstalled:{addListener(){}},openOptionsPage(){},
  sendMessage:message=>new Promise(resolve=>{for(const fn of routes)fn(message,{id:'test'},resolve);})},
  storage:{local:{get:async key=>({[key]:structuredClone(store[key])}),set:async value=>{Object.assign(store,structuredClone(value));},clear:async()=>{window.store={};}},
    onChanged:{addListener:fn=>storageListeners.push(fn)}},
  tabs:{onRemoved:{addListener(){}},onUpdated:{addListener(){}},query:async()=>[{id:1,url:'https://example.com/article'}],get:async()=>({id:1,url:'https://example.com/article'}),
    sendMessage:async(id,message)=>{
      if(message.type==='READING_TOOLS_UPDATED')tabState.readingRuler=store['webbyReadingTools:example.com']?.readingRuler===true;
      if(message.type==='SET_FOCUS_READING')tabState.focusReading=message.enabled;
      return {ok:true,data:{...tabState}};
    }}};
</script><script type="module">await import('/background.js');await import('/popup.js');window.popupReady=true;</script>`;

export const popupTests = `<script type="module">
try {
const wait=()=>new Promise(resolve=>setTimeout(resolve,60));
for(let i=0;i<10 && !window.popupReady;i++)await wait();await wait();
const el=id=>document.getElementById(id);
for(const [id,font,line] of [['low-vision','145','190'],['calm','115','175']]){
  const button=document.querySelector('[data-preset="'+id+'"]');button.click();await wait();
  check(el('fontScale').value===font && el('lineHeight').value===line && button.getAttribute('aria-pressed')==='true','preset '+id+' applies exact values and updates selected card');
  check(store.webbyOverrides?.[0]?.patch.fontScale===Number(font)/100,'preset '+id+' saves through actual background and storage');
}
el('darkMode').click();await wait();
check(store.webbyOverrides[0].patch.darkMode && el('darkMode').getAttribute('aria-pressed')==='true' && el('fontScale').value==='115',
  'Dark Mode card immediately applies and saves without changing text size');
el('darkMode').click();await wait();
check(!store.webbyOverrides[0].patch.darkMode && el('darkMode').getAttribute('aria-pressed')==='false' && el('presetState').textContent==='Calm Mode',
  'Dark Mode card toggles off and restores the selected preset state');
el('fontScale').value='130';el('fontScale').dispatchEvent(new Event('input'));
check(el('presetState').textContent==='Custom','manual edits show Custom');
el('saveSite').click();await wait();
check(store.webbyOverrides[0].patch.fontScale===1.3,'existing Save still persists manual customization');
el('resetSite').click();await wait();
check(store.webbyOverrides.length===0 && el('fontScale').value==='110' && el('presetState').textContent==='Custom','Reset clears preset and restores global profile');
el('readingRuler').checked=true;el('readingRuler').dispatchEvent(new Event('change'));await wait();
check(store['webbyReadingTools:example.com']?.readingRuler===true && tabState.readingRuler,'ruler uses independent per-site storage and refreshes active tab');
el('focusReading').click();await wait();
check(tabState.focusReading && el('focusReading').getAttribute('aria-pressed')==='true' && el('focusReading').querySelector('small').textContent==='Exit text-only view' && el('fontScale').value==='110',
  'Reading Mode card opens the text-only reader without applying the removed text-size preset');
el('focusReading').click();await wait();
check(!tabState.focusReading && el('focusReading').getAttribute('aria-pressed')==='false','Reading Mode card exits the reader');
el('fontScale').value='120';el('fontScale').dispatchEvent(new Event('input'));
el('saveSite').click();await wait();
check(!('readingRuler' in store.webbyOverrides[0].patch),'reading tools never extend the validated override schema');
el('darkMode').click();await wait();
// Re-importing creates a fresh popup controller with the same saved preferences.
await import('/popup.js?reopened');await wait();
check(el('readingRuler').checked && el('fontScale').value==='120' && el('darkMode').getAttribute('aria-pressed')==='true','reopening popup restores ruler, Dark Mode card and effective site profile');
}catch(error){check(false,'Unexpected popup exception: '+error.message);}
const pre=document.createElement('pre');pre.id='browser-results';pre.textContent=JSON.stringify(results);document.body.append(pre);
</script>`;

export const dashboardSetup = popupSetup
  .replace('window.store={};',`window.store={
    webbyOverrides:[{hostname:'example.com',updatedAt:new Date().toISOString(),patch:{fontScale:1.3}}]
  };`)
  .replace("await import('/popup.js');window.popupReady=true;","await import('/dashboard.js');window.dashboardReady=true;");

export const dashboardTests = `<script type="module">
try {
const wait=()=>new Promise(resolve=>setTimeout(resolve,80));
for(let i=0;i<10 && !window.dashboardReady;i++)await wait();await wait();
const el=id=>document.getElementById(id);
check(el('statSites').textContent==='1','dashboard loads the site customization count');
for(const button of document.querySelectorAll('[data-tab]')){
  button.click();await wait();
  check(!el('tab-'+button.dataset.tab).classList.contains('hidden'),'dashboard navigation opens '+button.dataset.tab);
}
document.querySelector('[data-tab="preferences"]').click();await wait();
check(el('siteList').closest('section').id==='tab-preferences' && el('siteList').textContent.includes('example.com'),
  'website customizations remain available under Preferences');
el('siteList').querySelector('button').click();await wait();
check(store.webbyOverrides.length===0 && el('statSites').textContent==='0','removing a website customization resets its override');
el('prefFont').value='125';el('settingsForm').dispatchEvent(new Event('submit',{cancelable:true}));await wait();
check(store.webbyProfile.fontScale===1.25,'global preferences still save');
window.confirm=()=>true;el('clearData').click();await wait();
check(el('statSites').textContent==='0','clearing data resets all dashboard counts');
}catch(error){check(false,'Unexpected dashboard exception: '+error.message);}
const pre=document.createElement('pre');pre.id='browser-results';pre.textContent=JSON.stringify(results);document.body.append(pre);
</script>`;
