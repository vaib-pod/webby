import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROFILE,validateProfile,validatePatch,validateSummary,validateAnalyzeRequest,
  validateActions,fallbackRecommendations,validHostname
} from '../extension/shared/contracts.js';

function page(){return {category:'article',prefersDarkTheme:false,
  elements:[{id:'e1',role:'main',tag:'MAIN',textPreview:'PRIVATE USER CONTENT'}],
  issues:[{type:'small-text',severity:'high',elementId:'e1'},
    {type:'tight-spacing',severity:'medium',elementId:'e1'},
    {type:'low-contrast',severity:'medium',elementId:'e1'}],
  rawHtml:'<input value="private">',url:'https://private.example/secret'};}

test('Profile must have correct strict types and constrained numeric values',()=>{
  assert.deepEqual(validateProfile(DEFAULT_PROFILE),DEFAULT_PROFILE);
  assert.throws(()=>validateProfile({...DEFAULT_PROFILE,fontScale:5}));
  assert.throws(()=>validateProfile({...DEFAULT_PROFILE,enabled:'yes'}));
  assert.throws(()=>validatePatch({maliciousScript:'alert(1)'}));
});
test('Dark mode is a strict, backward-compatible profile preference',()=>{
  const darkProfile = validateProfile({...DEFAULT_PROFILE,darkMode:true});
  assert.equal(darkProfile.darkMode,true);
  assert.deepEqual(validatePatch({darkMode:true}),{darkMode:true});
  assert.throws(()=>validateProfile({...DEFAULT_PROFILE,darkMode:'yes'}));
  const legacyProfile = {...DEFAULT_PROFILE};
  delete legacyProfile.darkMode;
  assert.equal(validateProfile(legacyProfile).darkMode,false);
});

test('AI payload discards text, URL and unknown sensitive fields',()=>{
  const clean=validateSummary(page());
  assert.equal(clean.elements[0].textPreview,undefined);
  assert.equal(JSON.stringify(clean).includes('PRIVATE'),false);
  assert.equal(JSON.stringify(clean).includes('private.example'),false);
  assert.equal(clean.elements[0].role,'main');
});
test('Element summaries accept real heading tags H1–H6',()=>{
  const input = page();
  input.elements.push(
    {id:'e2',role:'heading',tag:'H1'},
    {id:'e3',role:'heading',tag:'H2'},
    {id:'e4',role:'heading',tag:'H6'}
  );
  const clean = validateSummary(input);
  assert.deepEqual(clean.elements.slice(1).map(element=>element.tag),['H1','H2','H6']);
});
test('API request validates and preserves minimal contract',()=>{
  const result=validateAnalyzeRequest({version:1,profile:DEFAULT_PROFILE,page:page()});
  assert.equal(result.page.rawHtml,undefined);
  assert.throws(()=>validateAnalyzeRequest({version:2,profile:DEFAULT_PROFILE,page:page()}));
});
test('Unknown or dangerous AI actions are filtered, not evaluated',()=>{
  const actions=validateActions([
    {type:'EXECUTE_SCRIPT',code:'alert(1)'},
    {type:'SET_TEXT_SCALE',factor:45},
    {type:'SET_LINE_HEIGHT',ratio:1.8,selector:'body',javascript:'bad'},
    {type:'HIGHLIGHT_MAIN',targetId:'e1'},
    {type:'HIGHLIGHT_MAIN',targetId:'e999'}
  ],validateSummary(page()));
  assert.deepEqual(actions,[{type:'SET_LINE_HEIGHT',ratio:1.8},{type:'HIGHLIGHT_MAIN',targetId:'e1'}]);
});
test('Fallback has usable actions and is honestly labeled',()=>{
  const result=fallbackRecommendations({version:1,profile:DEFAULT_PROFILE,page:page()});
  assert.equal(result.source,'fallback');
  assert.ok(result.actions.some(action=>action.type==='SET_TEXT_SCALE'));
  assert.ok(result.actions.some(action=>action.type==='BOOST_CONTRAST'));
  assert.ok(result.actions.some(action=>action.type==='HIGHLIGHT_MAIN'));
});
test('Only lowercase hostname strings are accepted',()=>{
  assert.equal(validHostname('example.com'),true);
  assert.equal(validHostname('127.0.0.1'),true);
  assert.equal(validHostname('https://example.com/private'),false);
  assert.equal(validHostname('EXAMPLE.COM'),false);
});
