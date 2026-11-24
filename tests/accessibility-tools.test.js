import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS,matchingPreset} from '../extension/shared/presets.js';
import {DEFAULT_PROFILE,validatePatch} from '../extension/shared/contracts.js';
import {getReadingTools,saveReadingTools,readingToolsKey,getEffectiveProfile,
  saveOverride,clearAll} from '../extension/shared/storage.js';

test('presets contain the requested values and only validated profile fields', () => {
  const expected = [[1.45,1.9,'high',true],[1.15,1.75,'normal',true]];
  PRESETS.forEach((preset,index) => {
    const patch = validatePatch(preset.patch);
    assert.deepEqual([patch.fontScale,patch.lineHeight,patch.contrastMode,patch.reduceMotion],expected[index]);
    assert.equal(patch.enabled,true); assert.equal(patch.darkMode,false); assert.equal(patch.focusAssist,true);
    assert.equal(matchingPreset({...DEFAULT_PROFILE,...patch}).id,preset.id);
    for (const [key,value] of [['fontScale',1.3],['darkMode',true],['focusAssist',false],['enabled',false]]) {
      assert.equal(matchingPreset({...patch,[key]:value}),null);
    }
  });
  assert.equal(matchingPreset(DEFAULT_PROFILE),null);
  assert.equal(matchingPreset(null),null);
});

test('site presets and Reset preserve the existing storage contract', async () => {
  let data = {};
  globalThis.chrome = {storage:{local:{
    get:async key => ({[key]:structuredClone(data[key])}),
    set:async value => {Object.assign(data,structuredClone(value));},
    clear:async () => {data={};}
  }}};
  try {
    for (const preset of PRESETS) {
      await saveOverride({hostname:'example.com',updatedAt:new Date().toISOString(),patch:preset.patch});
      assert.equal(matchingPreset(await getEffectiveProfile('example.com')).id,preset.id);
      assert.deepEqual(await getEffectiveProfile('another.com'),DEFAULT_PROFILE);
    }
    await saveOverride({hostname:'example.com',updatedAt:new Date().toISOString(),patch:{}});
    assert.deepEqual(await getEffectiveProfile('example.com'),DEFAULT_PROFILE);

    assert.deepEqual(await getReadingTools('example.com'),{readingRuler:false});
    await saveReadingTools('example.com',{readingRuler:true});
    assert.deepEqual(await getReadingTools('example.com'),{readingRuler:true});
    assert.deepEqual(await getReadingTools('another.com'),{readingRuler:false});
    assert.deepEqual(await getEffectiveProfile('example.com'),DEFAULT_PROFILE);
    assert.ok(data.webbyOverrides.every(item => !('readingRuler' in item.patch)));
    await assert.rejects(saveReadingTools('example.com',{readingRuler:'true'}),/Invalid reading tools/);
    await assert.rejects(saveReadingTools('example.com',{readingRuler:true,fontScale:2}),/Invalid reading tools/);
    assert.throws(() => readingToolsKey('https://example.com'),/Invalid hostname/);
    data[readingToolsKey('example.com')] = {readingRuler:'corrupt'};
    assert.deepEqual(await getReadingTools('example.com'),{readingRuler:false});
    await saveReadingTools('example.com',{readingRuler:true});
    await saveOverride({hostname:'example.com',updatedAt:new Date().toISOString(),patch:{}});
    assert.equal((await getReadingTools('example.com')).readingRuler,true,'profile Reset does not change separate reading-tool preference');
    await clearAll();
    assert.deepEqual(await getReadingTools('example.com'),{readingRuler:false});
  } finally {delete globalThis.chrome;}
});
