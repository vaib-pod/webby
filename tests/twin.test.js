import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PROFILE} from '../extension/shared/contracts.js';
import {learnFromFeedback,summariseTwin} from '../extension/shared/twin.js';

test('Explicit feedback increases font scale by one step and respects upper bound',()=>{
  assert.equal(learnFromFeedback(DEFAULT_PROFILE,{},'text-too-small').fontScale,1.2);
  assert.equal(learnFromFeedback(DEFAULT_PROFILE,{fontScale:1.5},'text-too-small').fontScale,1.5);
});
test('Spacing feedback adjusts existing per-site preference',()=>{
  assert.equal(learnFromFeedback(DEFAULT_PROFILE,{lineHeight:1.7},'need-more-spacing').lineHeight,1.85);
});
test('Contrast and motion feedback are site-local, not inferred disabilities',()=>{
  assert.deepEqual(learnFromFeedback(DEFAULT_PROFILE,{},'increase-contrast'),{contrastMode:'high'});
  assert.deepEqual(learnFromFeedback(DEFAULT_PROFILE,{},'reduce-motion'),{reduceMotion:true});
});
test('Reset removes site-specific settings',()=>{
  assert.deepEqual(learnFromFeedback(DEFAULT_PROFILE,{fontScale:1.3},'reset-this-site'),{});
  assert.throws(()=>learnFromFeedback(DEFAULT_PROFILE,{},'unknown'));
});
test('Twin summary reflects explicit events, never passive browsing',()=>{
  const summary=summariseTwin([{hostname:'example.com',patch:{fontScale:1.2}}],
    [{kind:'text-too-small'},{kind:'reset-this-site'}]);
  assert.equal(summary.customizedSites,1);
  assert.equal(summary.adjustmentsLearned,1);
  assert.equal(summary.feedbackCounts['reset-this-site'],1);
});
