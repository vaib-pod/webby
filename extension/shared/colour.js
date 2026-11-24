// Preferences describe a chosen presentation, never a diagnosis.
export const PALETTES = Object.freeze([
  {id:'blue-amber',name:'Blue & amber',description:'Blue actions and amber notices, with underlines and clear borders.',ink:'#17283b',surface:'#ffffff',action:'#174f87',accent:'#875000',notice:'#fff3d6',series:['#174f87','#875000','#56505e']},
  {id:'purple-teal',name:'Purple & teal',description:'Purple actions and teal accents, with labels and patterned indicators.',ink:'#292336',surface:'#ffffff',action:'#663a82',accent:'#00675f',notice:'#edf8f5',series:['#663a82','#00675f','#765126']},
  {id:'graphite',name:'Graphite & patterns',description:'Light and dark contrast, underlines, outlines and patterns instead of hue.',ink:'#202020',surface:'#ffffff',action:'#303030',accent:'#555555',notice:'#f1f1f1',series:['#202020','#626262','#939393']}
]);
export const COLOUR_TYPES = Object.freeze([
  ['protanopia','Protanopia — red-cone deficiency','blue-amber'],
  ['protanomaly','Protanomaly — altered red sensitivity','blue-amber'],
  ['deuteranopia','Deuteranopia — green-cone deficiency','blue-amber'],
  ['deuteranomaly','Deuteranomaly — altered green sensitivity','blue-amber'],
  ['tritanopia','Tritanopia — blue-cone deficiency','purple-teal'],
  ['tritanomaly','Tritanomaly — altered blue sensitivity','purple-teal'],
  ['achromatopsia','Achromatopsia — very limited or absent colour perception','graphite'],
  ['unsure',"I'm not sure",'blue-amber']
]);
export const DEFAULT_COLOUR = Object.freeze({version:1,enabled:false,paletteId:'blue-amber',source:'manual',userConfirmed:false});
export function paletteById(id) { return PALETTES.find(palette=>palette.id===id); }
export function validateColourPreference(value) {
  const keys=['version','enabled','paletteId','source','userConfirmed'];
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!keys.includes(key)) ||
      value.version!==1 || typeof value.enabled!=='boolean' || typeof value.userConfirmed!=='boolean' ||
      !paletteById(value.paletteId) || !['manual','activity'].includes(value.source) || (value.enabled && !value.userConfirmed)) {
    throw new Error('Invalid colour preference');
  }
  return Object.fromEntries(keys.map(key=>[key,value[key]]));
}

export function normalizeAnswer(value) {
  if (value === 'unable') return value;
  if (typeof value!=='string' || !/^\d{1,6}$/.test(value.trim())) return null;
  return String(Number(value.trim()));
}
export function validatePlateManifest(value) {
  if (!value || value.version!==1 || !Array.isArray(value.plates) || !value.plates.length || value.plates.length>100) throw new Error('Invalid plate manifest');
  const ids=new Set(), paths=new Set();
  const plates=value.plates.map(plate=>{
    if (!plate || typeof plate.id!=='string' || !/^[a-z0-9-]{1,60}$/.test(plate.id) || ids.has(plate.id) ||
        typeof plate.path!=='string' || !/^assets\/colourblind\/[a-zA-Z0-9_-]+\.png$/.test(plate.path) || paths.has(plate.path) ||
        typeof plate.scored!=='boolean' || !['unverified','verified'].includes(plate.verification) ||
        !Array.isArray(plate.expectedAnswers) || !/^[a-f0-9]{64}$/.test(plate.sha256)) throw new Error('Invalid plate entry');
    ids.add(plate.id); paths.add(plate.path);
    const answers=plate.expectedAnswers.map(normalizeAnswer);
    if (plate.scored && (plate.verification!=='verified' || !answers.length || answers.some(answer=>answer===null || answer==='unable') ||
        typeof plate.source!=='string' || !plate.source.trim())) throw new Error('Every scored plate needs a verified numeric answer key and source');
    return {...plate,expectedAnswers:answers};
  });
  return {version:1,plates};
}
export function createAssessment(manifest) {
  const {plates}=validatePlateManifest(manifest);
  let index=0;
  const answers=new Map();
  return {
    plates, answers,
    get index(){return index;},
    get current(){return plates[index];},
    go(next){if(!Number.isInteger(next)||next<0||next>=plates.length)throw new Error('Invalid question');index=next;},
    answer(value){const answer=normalizeAnswer(value);if(answer===null)answers.delete(plates[index].id);else answers.set(plates[index].id,answer);return answer;}
  };
}
export function scoreAssessment(manifest,answers,verifiedImages) {
  const {plates}=validatePlateManifest(manifest);
  const scored=plates.filter(plate=>plate.scored);
  if (!scored.length) throw new Error('Scoring is unavailable until a verified answer key is configured');
  if (plates.some(plate=>normalizeAnswer(answers.get(plate.id))===null)) throw new Error('Answer every question or choose “I can’t see a number”');
  if (scored.some(plate=>!verifiedImages?.has(plate.id))) throw new Error('Scored images must match their verified checksums');
  let correct=0,incorrect=0,unable=0;
  for(const plate of scored){
    const answer=normalizeAnswer(answers.get(plate.id));
    if(answer==='unable')unable++;
    else if(plate.expectedAnswers.includes(answer))correct++;
    else incorrect++;
  }
  const summary=unable===scored.length ? 'Your results are inconclusive.' : incorrect || unable ?
    'Your responses suggest possible difficulty distinguishing some of the colours in this activity.' :
    'This activity did not identify a clear colour-discrimination difficulty.';
  return {total:plates.length,scored:scored.length,unscored:plates.length-scored.length,correct,incorrect,unable,summary};
}
