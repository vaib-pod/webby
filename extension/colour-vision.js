import {PALETTES,COLOUR_TYPES,DEFAULT_COLOUR,paletteById,validatePlateManifest,createAssessment,scoreAssessment} from './shared/colour.js';

const $=id=>document.getElementById(id);
const titles={path:'Colour Vision Support',manual:'Choose your colour profile',assessment:'Explore your colour vision',review:'Review your answers',results:'Your activity results',settings:'Colour support settings'};
let saved={...DEFAULT_COLOUR}, selected=saved.paletteId, source='manual', screen='path';
let assessment=null, manifest=null, verifiedImages=new Set(), imageErrors=new Set(), loadRevision=0, ready=false;
let saving=false, globalEnabled=true, settingsRevision=0;

async function send(message){
  const reply=await chrome.runtime.sendMessage(message);
  if(!reply?.ok)throw new Error(reply?.error || 'WEBBY could not save your preferences.');
  return reply.data;
}
function notice(message,error=false){$('message').textContent=message;$('message').classList.toggle('error',error);}
function show(next){
  screen=next;
  for(const el of document.querySelectorAll('.screen'))el.classList.toggle('hidden',el.id!==`${next}Screen`);
  $('paletteEditor').classList.toggle('hidden',!['manual','settings','results'].includes(next));
  $('backToPaths').classList.toggle('hidden',next==='path');
  $('screenTitle').textContent=titles[next];$('screenTitle').focus();
  $('applyPreference').textContent=next==='results'?'Apply My Preference':'Apply to Websites';
}
function discardAnswers(){
  loadRevision++;
  assessment?.answers.clear();assessment=null;
  $('plateAnswer').value='';$('plateImage').removeAttribute('src');$('answerReview').replaceChildren();
}
function setSelected(id){
  selected=id;
  for(const input of document.querySelectorAll('input[name="palette"]'))input.checked=input.value===id;
}
function manual(){
  discardAnswers();source='manual';
  $('visionType').value='unsure';setSelected(saved.userConfirmed?saved.paletteId:'blue-amber');
  $('recommendation').textContent='Compare the palettes below and choose what feels clearest.';
  notice('');show('manual');
}
function renderSettings(){
  $('colourEnabled').checked=saved.enabled;
  $('colourEnabled').disabled=!ready || saving;
  $('applyPreference').disabled=!ready || saving;
  $('clearPreference').disabled=!ready || saving;
  $('savedPreference').textContent=saved.userConfirmed?
    `${paletteById(saved.paletteId).name} · ${saved.enabled?'Enabled':'Disabled'} · Chosen ${saved.source==='activity'?'after the activity':'manually'}.`:
    'Choose a palette below, then turn on colour support or choose Apply to Websites.';
  $('applicationStatus').textContent=!saved.enabled?'Colour support is off.':!globalEnabled?
    'Your palette is saved, but the global WEBBY profile is paused. Check dashboard Preferences if a website does not change.':
    'Colour support is on. Buttons and notices use your palette, including in Dark Mode. Search/navigation links and media keep their original appearance.';
}
function settings(){discardAnswers();source=saved.source;setSelected(saved.paletteId);renderSettings();notice('');show('settings');}

for(const [value,label] of COLOUR_TYPES){const option=document.createElement('option');option.value=value;option.textContent=label;$('visionType').append(option);}
for(const palette of PALETTES){
  const card=document.createElement('article');card.className='palette-option';
  // All template values are fixed extension-owned palette constants, never page/user data.
  card.innerHTML=`<label class="palette-choice"><input type="radio" name="palette" value="${palette.id}"><span>${palette.name}</span></label><p>${palette.description}</p>
    <div class="palette-preview"><strong>Clear text, useful choices</strong><p>A readable sample with an <a href="#paletteTitle">underlined link</a>.</p>
    <button type="button" class="sample-button" aria-pressed="false">Example button</button>
    <div class="sample-warning"><strong>Warning:</strong> Check your changes before continuing.</div>
    <div class="sample-chart" aria-label="Example chart: North 70, South 50, West 30">
    <div class="chart-row"><span>North 70</span><span class="chart-bar" aria-hidden="true"></span></div>
    <div class="chart-row"><span>South 50</span><span class="chart-bar" aria-hidden="true"></span></div>
    <div class="chart-row"><span>West 30</span><span class="chart-bar" aria-hidden="true"></span></div></div></div>`;
  for(const key of ['ink','surface','action','accent','notice'])card.style.setProperty(`--cv-${key}`,palette[key]);
  card.querySelectorAll('.chart-bar').forEach((bar,index)=>{
    bar.style.width=`${[100,72,43][index]}%`;bar.style.backgroundColor=palette.series[index];
    if(index)bar.style.backgroundImage=index===1?'repeating-linear-gradient(45deg,transparent 0 6px,#fff 6px 8px)':'repeating-linear-gradient(0deg,transparent 0 5px,#fff 5px 7px)';
  });
  card.querySelector('input').addEventListener('change',()=>{selected=palette.id;});
  const button=card.querySelector('.sample-button');
  button.addEventListener('click',()=>{const pressed=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(pressed));button.textContent=pressed?'Selected example':'Example button';});
  $('paletteOptions').append(card);
}
setSelected(selected);
$('visionType').addEventListener('change',()=>{
  const type=COLOUR_TYPES.find(item=>item[0]===$('visionType').value);
  setSelected(type[2]);
  $('recommendation').textContent=`Suggested starting point: ${paletteById(type[2]).name}. Compare all three; your own preference takes priority.`;
});
$('selectType').addEventListener('click',manual);
$('changeType').addEventListener('click',manual);
$('openSettings').addEventListener('click',settings);
$('backToPaths').addEventListener('click',()=>{discardAnswers();notice('');show('path');});
$('resetSelection').addEventListener('click',()=>{
  $('visionType').value='unsure';setSelected(saved.userConfirmed?saved.paletteId:DEFAULT_COLOUR.paletteId);
  $('recommendation').textContent='Compare the palettes below and choose what feels clearest.';
  notice('Selection reset. Your saved preference has not changed.');
});
async function persist(preference){
  if(!ready || saving)return;
  saving=true;renderSettings();
  try{saved=await send({type:'SAVE_COLOUR_PREFERENCE',preference});notice(saved.enabled&&!globalEnabled?
    'Palette saved. The global WEBBY profile is paused; check dashboard Preferences if a website does not change.':
    `${paletteById(saved.paletteId).name} ${saved.enabled?'enabled. Refresh previously open webpages if they have not updated.':'disabled.'}`);}
  catch(error){notice(error.message,true);renderSettings();}
  finally{saving=false;renderSettings();}
}
$('applyPreference').addEventListener('click',()=>persist({version:1,enabled:true,paletteId:selected,source,userConfirmed:true}));
$('colourEnabled').addEventListener('change',()=>persist($('colourEnabled').checked?
  {version:1,enabled:true,paletteId:selected,source,userConfirmed:true}:{...saved,enabled:false}));
$('clearPreference').addEventListener('click',async()=>{
  if(!ready || saving)return;
  saving=true;renderSettings();
  try{saved=await send({type:'CLEAR_COLOUR_PREFERENCE'});source='manual';setSelected(saved.paletteId);renderSettings();notice('Colour preferences cleared. Other WEBBY settings are unchanged.');}
  catch(error){notice(error.message,true);}finally{saving=false;renderSettings();}
});

async function startAssessment(){
  discardAnswers();notice('');show('assessment');
  const revision=loadRevision;
  $('answerForm').classList.add('hidden');$('questionProgress').textContent='Loading local plates…';$('keyStatus').textContent='';$('imageStatus').textContent='';
  try{
    const response=await fetch(chrome.runtime.getURL('assets/colourblind/plates.json'));
    if(!response.ok)throw new Error('The local plate manifest could not be loaded.');
    const loaded=validatePlateManifest(await response.json());
    const verified=new Set(), errors=new Set();
    for(const plate of loaded.plates){
      try{
        const response=await fetch(chrome.runtime.getURL(plate.path));
        if(!response.ok)throw new Error('Missing image');
        const blob=await response.blob(), bytes=await blob.arrayBuffer();
        const bitmap=await createImageBitmap(blob);bitmap.close();
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
        if(hash!==plate.sha256)throw new Error('Image changed');
        verified.add(plate.id);
      }catch{errors.add(plate.id);}
      if(revision!==loadRevision)return;
    }
    manifest=loaded;verifiedImages=verified;imageErrors=errors;assessment=createAssessment(manifest);
    $('answerForm').classList.remove('hidden');
    const count=manifest.plates.filter(plate=>plate.scored).length;
    $('keyStatus').textContent=count?`${count} of ${manifest.plates.length} plates have a verified answer key. Unverified plates do not count toward results.`:
      'Explore-only: these plates do not yet have a verified answer key. You can view and review them, but scoring is unavailable. You can choose a colour profile manually at any time.';
    renderQuestion();
  }catch(error){if(revision===loadRevision){$('questionProgress').textContent='Activity unavailable';notice(error.message,true);}}
}
for(const id of ['startAssessment','retakeAssessment','settingsRetake'])$(id).addEventListener('click',startAssessment);
function renderQuestion(){
  if(!assessment)return;
  const plate=assessment.current, answer=assessment.answers.get(plate.id);
  $('questionProgress').textContent=`Question ${assessment.index+1} of ${assessment.plates.length}`;
  $('questionMeter').max=assessment.plates.length;$('questionMeter').value=assessment.index+1;
  $('plateImage').alt=`Colour plate, question ${assessment.index+1}. What number do you see?`;
  $('plateImage').src=chrome.runtime.getURL(plate.path);
  $('plateAnswer').value=answer && answer!=='unable'?answer:'';
  $('unableAnswer').setAttribute('aria-pressed',String(answer==='unable'));
  $('answerStatus').textContent=answer==='unable'?'Recorded: unable to identify a number.':'';
  $('imageStatus').textContent=imageErrors.has(plate.id)?'This image is missing or has changed since verification. Scoring cannot use it.':'';
  $('previousQuestion').disabled=assessment.index===0;
  $('nextQuestion').textContent=assessment.index===assessment.plates.length-1?'Review answers':'Next';
  $('plateAnswer').focus();
}
$('plateImage').addEventListener('error',()=>{
  if(!assessment)return;
  imageErrors.add(assessment.current.id);verifiedImages.delete(assessment.current.id);
  $('imageStatus').textContent='This plate could not be displayed. It cannot be scored.';
});
$('plateAnswer').addEventListener('input',()=>{
  if(!assessment)return;
  const value=$('plateAnswer').value;
  const answer=assessment.answer(value);
  $('unableAnswer').setAttribute('aria-pressed','false');
  $('answerStatus').textContent=value && answer===null?'Enter a whole number using digits only.':'';
});
$('unableAnswer').addEventListener('click',()=>{
  if(!assessment)return;
  assessment.answer('unable');$('plateAnswer').value='';$('unableAnswer').setAttribute('aria-pressed','true');$('answerStatus').textContent='Recorded: unable to identify a number.';
});
$('previousQuestion').addEventListener('click',()=>{if(assessment?.index>0){assessment.go(assessment.index-1);renderQuestion();}});
$('answerForm').addEventListener('submit',event=>{
  event.preventDefault();if(!assessment)return;
  if(assessment.index===assessment.plates.length-1)review();else{assessment.go(assessment.index+1);renderQuestion();}
});
function review(){
  if(!assessment)return;
  $('answerReview').replaceChildren();
  assessment.plates.forEach((plate,index)=>{
    const item=document.createElement('li'),button=document.createElement('button'),answer=assessment.answers.get(plate.id);
    button.type='button';button.className='btn secondary';
    button.textContent=`Question ${index+1}: ${answer==='unable'?"Can't see a number":answer??'Unanswered'}${plate.scored?'':' · Not scored'}`;
    button.addEventListener('click',()=>{assessment.go(index);show('assessment');renderQuestion();});item.append(button);$('answerReview').append(item);
  });
  try{scoreAssessment(manifest,assessment.answers,verifiedImages);$('submitAssessment').disabled=false;$('reviewStatus').textContent='Ready to submit. Individual answers will be discarded after scoring.';}
  catch(error){$('submitAssessment').disabled=true;$('reviewStatus').textContent=error.message;}
  show('review');
}
$('reviewAnswers').addEventListener('click',review);
$('returnToQuestion').addEventListener('click',()=>{show('assessment');renderQuestion();});
$('submitAssessment').addEventListener('click',()=>{
  if(!assessment)return;
  try{
    const result=scoreAssessment(manifest,assessment.answers,verifiedImages);
    $('resultSummary').textContent=result.summary;$('resultCounts').replaceChildren();
    for(const [label,value] of [['Total questions',result.total],['Scored plates',result.scored],['Correctly identified',result.correct],['Incorrect responses',result.incorrect],['Unable to identify',result.unable],['Unverified / not scored',result.unscored]]){
      const term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=String(value);$('resultCounts').append(term,description);
    }
    discardAnswers();source='activity';setSelected('blue-amber');notice('Your answers have been discarded. Only an applied palette choice will be saved.');show('results');
  }catch(error){notice(error.message,true);}
});
$('previewAdaptations').addEventListener('click',()=>{$('paletteTitle').focus();$('paletteTitle').scrollIntoView({behavior:'auto',block:'start'});});
window.addEventListener('pagehide',discardAnswers);
async function syncSettings(){
  const revision=++settingsRevision;
  try{
    const [preference,profile]=await Promise.all([send({type:'GET_COLOUR_PREFERENCE'}),send({type:'GET_PROFILE'})]);
    if(revision!==settingsRevision)return;
    const dirty=ready&&selected!==saved.paletteId;
    saved=preference;globalEnabled=profile.enabled;ready=true;
    if(!dirty){setSelected(saved.paletteId);source=saved.source;}
    renderSettings();
  }
  catch(error){notice(error.message,true);}
}
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&(changes.webbyColourPreference||changes.webbyProfile))syncSettings();
});
syncSettings().then(()=>{if(location.hash==='#settings')settings();});
