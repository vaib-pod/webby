import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DEFAULT_COLOUR,PALETTES,COLOUR_TYPES,validateColourPreference,validatePlateManifest,normalizeAnswer,createAssessment,scoreAssessment} from '../extension/shared/colour.js';
import {saveColourPreference,getColourPreference,clearColourPreference,saveOverride,getEffectiveProfile,saveReadingTools,getReadingTools} from '../extension/shared/storage.js';
import {getAccessibilityTwin} from '../extension/shared/twin.js';

const manifest=JSON.parse(await readFile(new URL('../extension/assets/colourblind/plates.json',import.meta.url),'utf8'));
const confirmed=['12','8','29','5','3','15','6','45','73','26'];
const images=new Set(manifest.plates.map(plate=>plate.id));
const answers=()=>new Map(manifest.plates.map((plate,index)=>[plate.id,confirmed[index]]));

test('configured answer key matches the user-confirmed images and exact image bytes',async()=>{
  validatePlateManifest(manifest);
  assert.equal(manifest.plates.length,confirmed.length);
  for(const [index,plate] of manifest.plates.entries()){
    assert.equal(plate.scored,true);assert.equal(plate.verification,'verified');
    assert.deepEqual(plate.expectedAnswers,[confirmed[index]]);
    const bytes=await readFile(new URL(`../extension/${plate.path}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),plate.sha256);
  }
});
test('assessment reports counts without medical classification',()=>{
  const all=scoreAssessment(manifest,answers(),images);
  assert.equal(all.correct,10);assert.equal(all.incorrect,0);assert.equal(all.unable,0);
  assert.equal(all.summary,'This activity did not identify a clear colour-discrimination difficulty.');
  const mixed=answers();mixed.set('plate-02','99');mixed.set('plate-03','unable');
  const result=scoreAssessment(manifest,mixed,images);
  assert.deepEqual([result.total,result.scored,result.correct,result.incorrect,result.unable],[10,10,8,1,1]);
  assert.match(result.summary,/possible difficulty/);
  for(const id of mixed.keys())mixed.set(id,'unable');
  assert.equal(scoreAssessment(manifest,mixed,images).summary,'Your results are inconclusive.');
  assert.doesNotMatch(JSON.stringify(result),/diagnosis|protan|deuter|tritan|achromat/i);
});
test('blank, malformed and missing answers cannot be submitted; unable is an explicit choice',()=>{
  for(const invalid of ['', ' ', '-5', '2.9','1e2','abc',null,12,'1234567'])assert.equal(normalizeAnswer(invalid),null);
  assert.equal(normalizeAnswer(' 012 '),'12');assert.equal(normalizeAnswer('unable'),'unable');
  const incomplete=answers();incomplete.delete('plate-01');assert.throws(()=>scoreAssessment(manifest,incomplete,images),/Answer every/);
  incomplete.set('plate-01','');assert.throws(()=>scoreAssessment(manifest,incomplete,images),/Answer every/);
});
test('navigation preserves answers, supports review edits and rejects invalid indices',()=>{
  const state=createAssessment(manifest);state.answer('12');state.go(1);state.answer('unable');state.go(0);
  assert.equal(state.answers.get(state.current.id),'12');state.answer('13');state.go(1);
  assert.equal(state.answers.get(state.current.id),'unable');state.answer('bad');assert.equal(state.answers.has(state.current.id),false);
  state.go(0);assert.equal(state.answers.get(state.current.id),'13');
  for(const index of [-1,manifest.plates.length,1.5])assert.throws(()=>state.go(index));
});
test('unverified plates are excluded and incomplete or changed keys block scoring',()=>{
  const partial=structuredClone(manifest);partial.plates[1].scored=false;partial.plates[1].verification='unverified';partial.plates[1].expectedAnswers=[];
  const data=answers();data.set('plate-02','wrong');assert.throws(()=>scoreAssessment(partial,data,images),/Answer every/);
  data.set('plate-02','unable');assert.equal(scoreAssessment(partial,data,images).scored,9);assert.equal(scoreAssessment(partial,data,images).unable,0);
  const disabled=structuredClone(partial);for(const plate of disabled.plates)plate.scored=false;
  assert.throws(()=>scoreAssessment(disabled,data,images),/verified answer key/);
  for(const patch of [{verification:'unverified'},{expectedAnswers:[]},{expectedAnswers:['unable']},{source:null}]){
    const broken=structuredClone(manifest);Object.assign(broken.plates[0],patch);assert.throws(()=>validatePlateManifest(broken));
  }
  assert.throws(()=>scoreAssessment(manifest,answers(),new Set()),/checksums/);
  for(const path of ['https://example.com/plate.png','../plate.png','assets/colourblind/../../plate.png']){
    const broken=structuredClone(manifest);broken.plates[0].path=path;assert.throws(()=>validatePlateManifest(broken));
  }
  const duplicate=structuredClone(manifest);duplicate.plates.push(duplicate.plates[0]);assert.throws(()=>validatePlateManifest(duplicate));
});
test('all manual categories suggest an overridable palette and preference validation rejects diagnoses',()=>{
  assert.equal(COLOUR_TYPES.length,8);
  for(const [, ,id] of COLOUR_TYPES)assert.ok(PALETTES.some(p=>p.id===id));
  for(const palette of PALETTES)assert.equal(validateColourPreference({...DEFAULT_COLOUR,enabled:true,userConfirmed:true,paletteId:palette.id}).paletteId,palette.id);
  for(const patch of [{enabled:true},{diagnosis:'protanopia'},{paletteId:'unknown'},{source:'inferred'},{enabled:'yes'},{userConfirmed:1}])assert.throws(()=>validateColourPreference({...DEFAULT_COLOUR,...patch}));
});
test('colour storage and Twin integration survive reload without changing site profiles or reading tools',async()=>{
  let data={};globalThis.chrome={storage:{local:{
    get:async key=>({[key]:structuredClone(data[key])}),set:async value=>Object.assign(data,structuredClone(value)),remove:async key=>{delete data[key];}
  }}};
  try{
    await saveOverride({hostname:'example.com',updatedAt:new Date().toISOString(),patch:{fontScale:1.45,darkMode:true}});
    await saveReadingTools('example.com',{readingRuler:true});const original=structuredClone(data.webbyOverrides);
    const preference={...DEFAULT_COLOUR,enabled:true,userConfirmed:true,paletteId:'graphite',source:'activity'};
    await saveColourPreference(preference);
    const fresh=await import('../extension/shared/storage.js?reload-colour');assert.deepEqual(await fresh.getColourPreference(),preference);
    const twin=await getAccessibilityTwin('example.com');assert.deepEqual(twin.colourPreference,preference);assert.equal(twin.profile.fontScale,1.45);
    assert.deepEqual(data.webbyOverrides,original);assert.equal((await getReadingTools('example.com')).readingRuler,true);
    assert.equal((await getEffectiveProfile('example.com')).darkMode,true);
    await saveColourPreference({...preference,enabled:false});assert.equal((await getColourPreference()).enabled,false);
    await clearColourPreference();assert.deepEqual(await getColourPreference(),DEFAULT_COLOUR);assert.deepEqual(data.webbyOverrides,original);
    assert.ok(!Object.keys(data).some(key=>/answer|diagnos|assessment/i.test(key)));
    data.webbyColourPreference={enabled:true,paletteId:'bad'};assert.deepEqual(await getColourPreference(),DEFAULT_COLOUR);
  }finally{delete globalThis.chrome;}
});
