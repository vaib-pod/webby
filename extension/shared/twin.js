import {clamp, FEEDBACK_KINDS, validatePatch, validateProfile} from './contracts.js';

/** Explicit user feedback changes site-local preference overrides. No behavioral surveillance. */
export function learnFromFeedback(baseProfile, oldPatch, kind) {
  if (!FEEDBACK_KINDS.includes(kind)) throw new Error('Unknown feedback kind');
  if (kind === 'reset-this-site') return {};
  const effective = validateProfile({...baseProfile, ...validatePatch(oldPatch ?? {})});
  const patch = {...(oldPatch ?? {})};
  switch (kind) {
    case 'text-too-small': patch.fontScale = Number(clamp(effective.fontScale + 0.1, 1, 1.5).toFixed(2)); break;
    case 'need-more-spacing': patch.lineHeight = Number(clamp(effective.lineHeight + 0.15, 1.2, 2).toFixed(2)); break;
    case 'increase-contrast': patch.contrastMode = 'high'; break;
    case 'reduce-motion': patch.reduceMotion = true; break;
  }
  return validatePatch(patch);
}

export function summariseTwin(overrides, feedback) {
  const counts = Object.fromEntries(FEEDBACK_KINDS.map(kind => [kind,0]));
  feedback.forEach(event => {if (counts[event.kind] !== undefined) counts[event.kind]++;});
  return {
    customizedSites:overrides.filter(override => Object.keys(override.patch).length > 0).length,
    adjustmentsLearned:feedback.filter(event => event.kind !== 'reset-this-site').length,
    feedbackCounts:counts,
    recentFeedback:[...feedback].slice(-8).reverse()
  };
}
