import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PROFILE,validateProfile,validatePatch,validHostname} from '../extension/shared/contracts.js';

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

test('Only lowercase hostname strings are accepted',()=>{
  assert.equal(validHostname('example.com'),true);
  assert.equal(validHostname('127.0.0.1'),true);
  assert.equal(validHostname('https://example.com/private'),false);
  assert.equal(validHostname('EXAMPLE.COM'),false);
});
