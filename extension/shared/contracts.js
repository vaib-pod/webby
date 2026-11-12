/**
 * WEBBY v1 shared public contracts and validators.
 * Browser/Node ES module; dependency-free by design. No personal data is needed.
 */
export const DEFAULT_PROFILE = Object.freeze({
  version: 1,
  enabled: true,
  fontScale: 1.1,
  lineHeight: 1.6,
  contrastMode: 'normal',
  darkMode: false,
  reduceMotion: false,
  focusAssist: true
});

export const FEEDBACK_KINDS = Object.freeze([
  'text-too-small', 'need-more-spacing', 'increase-contrast',
  'reduce-motion', 'reset-this-site'
]);
export const PAGE_CATEGORIES = Object.freeze(['article','landing','documentation','dashboard','other']);
export const ISSUE_TYPES = Object.freeze(['small-text','tight-spacing','low-contrast','motion','weak-focus','clutter']);
export const ACTION_TYPES = Object.freeze([
  'SET_TEXT_SCALE','SET_LINE_HEIGHT','BOOST_CONTRAST',
  'REDUCE_MOTION','ENHANCE_FOCUS','HIGHLIGHT_MAIN'
]);

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const plainString = (value, max = 180) => typeof value === 'string' ? value.slice(0, max) : '';

export function validHostname(hostname) {
  return typeof hostname === 'string' && hostname.length >= 1 && hostname.length <= 253 &&
    hostname.toLowerCase() === hostname &&
    hostname !== 'localhost' && /^[a-z0-9.-]+$/.test(hostname) &&
    !hostname.includes('..') && !hostname.startsWith('.') && !hostname.endsWith('.');
}

export function validateProfile(input) {
  if (!isObject(input) || input.version !== 1) throw new Error('Invalid profile version');
  // darkMode defaults to false for profiles saved by earlier WEBBY versions.
  const darkMode = input.darkMode === undefined ? false : input.darkMode;
  if (typeof input.enabled !== 'boolean' || typeof darkMode !== 'boolean' ||
      typeof input.reduceMotion !== 'boolean' || typeof input.focusAssist !== 'boolean') {
    throw new Error('Profile toggles must be booleans');
  }
  if (typeof input.fontScale !== 'number' || !Number.isFinite(input.fontScale) ||
      input.fontScale < 1 || input.fontScale > 1.5) throw new Error('fontScale must be 1.0–1.5');
  if (typeof input.lineHeight !== 'number' || !Number.isFinite(input.lineHeight) ||
      input.lineHeight < 1.2 || input.lineHeight > 2) throw new Error('lineHeight must be 1.2–2.0');
  if (!['normal','high'].includes(input.contrastMode)) throw new Error('Invalid contrast mode');
  const {version, enabled, fontScale, lineHeight, contrastMode, reduceMotion, focusAssist} = input;
  return {version, enabled, fontScale, lineHeight, contrastMode, darkMode, reduceMotion, focusAssist};
}

export function validatePatch(patch) {
  if (!isObject(patch)) throw new Error('Invalid override patch');
  const allowed = ['enabled', 'fontScale', 'lineHeight', 'contrastMode', 'darkMode', 'reduceMotion', 'focusAssist'];
  if (Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('Unknown override key');
  const merged = validateProfile({...DEFAULT_PROFILE, ...patch});
  return Object.fromEntries(Object.keys(patch).map(key => [key, merged[key]]));
}

export function validateOverride(value) {
  if (!isObject(value) || !validHostname(value.hostname)) throw new Error('Invalid hostname');
  if (!Number.isFinite(Date.parse(value.updatedAt))) throw new Error('Invalid override date');
  return {hostname: value.hostname, updatedAt: value.updatedAt, patch: validatePatch(value.patch)};
}

function validElement(element) {
  return isObject(element) && /^e\d{1,5}$/.test(element.id) &&
    ['main','heading','paragraph','navigation','button','image','other'].includes(element.role) &&
    typeof element.tag === 'string' && /^[A-Z][A-Z0-9]{0,14}$/.test(element.tag);
}

export function validateSummary(page) {
  if (!isObject(page) || !PAGE_CATEGORIES.includes(page.category) ||
      typeof page.prefersDarkTheme !== 'boolean') throw new Error('Invalid page summary');
  if (!Array.isArray(page.elements) || page.elements.length > 30 ||
      !page.elements.every(validElement)) throw new Error('Invalid element summaries');
  if (!Array.isArray(page.issues) || page.issues.length > 30 ||
      !page.issues.every(issue => isObject(issue) && ISSUE_TYPES.includes(issue.type) &&
          ['low','medium','high'].includes(issue.severity) &&
          (issue.elementId === undefined || /^e\d{1,5}$/.test(issue.elementId)))) {
    throw new Error('Invalid issue summaries');
  }
  // Deliberately discard every unknown field, including page text, URLs and form content.
  return {
    category: page.category,
    prefersDarkTheme: page.prefersDarkTheme,
    elements: page.elements.map(({id,role,tag}) => ({id,role,tag})),
    issues: page.issues.map(({type,severity,elementId}) =>
      elementId ? {type,severity,elementId} : {type,severity})
  };
}

export function validateAnalyzeRequest(body) {
  if (!isObject(body) || body.version !== 1) throw new Error('Invalid API version');
  return {version:1, profile:validateProfile(body.profile), page:validateSummary(body.page)};
}

/** Strict allowlist: no CSS, HTML, JS, selectors or external URLs can be returned by AI. */
export function validateActions(actions, page) {
  if (!Array.isArray(actions)) return [];
  const availableIds = new Set(page.elements.map(element => element.id));
  const result = [];
  for (const candidate of actions.slice(0, 12)) {
    if (!isObject(candidate) || !ACTION_TYPES.includes(candidate.type)) continue;
    if (candidate.targetId !== undefined && !availableIds.has(candidate.targetId)) continue;
    const action = {type:candidate.type};
    if (candidate.targetId) action.targetId = candidate.targetId;
    if (candidate.type === 'SET_TEXT_SCALE') {
      if (typeof candidate.factor !== 'number' || !Number.isFinite(candidate.factor) ||
        candidate.factor < 1 || candidate.factor > 1.5) continue;
      action.factor = candidate.factor;
    }
    if (candidate.type === 'SET_LINE_HEIGHT') {
      if (typeof candidate.ratio !== 'number' || !Number.isFinite(candidate.ratio) ||
        candidate.ratio < 1.2 || candidate.ratio > 2) continue;
      action.ratio = candidate.ratio;
    }
    if (candidate.type === 'HIGHLIGHT_MAIN') {
      if (!candidate.targetId || page.elements.find(el => el.id === candidate.targetId)?.role !== 'main') continue;
    }
    if (['REDUCE_MOTION','ENHANCE_FOCUS'].includes(candidate.type) && candidate.targetId) continue;
    result.push(action);
    if (result.length === 6) break;
  }
  return result;
}

export function validateAnalyzeResponse(value, page) {
  if (!isObject(value)) throw new Error('Invalid analysis result');
  const actions = validateActions(value.actions, page);
  return {
    version:1,
    source: value.source === 'ai' ? 'ai' : 'fallback',
    actions,
    reasons: Array.isArray(value.reasons) ? value.reasons.filter(v => typeof v === 'string')
      .slice(0, 5).map(v => plainString(v, 160)) : []
  };
}

/** Honest deterministic suggestions when the AI service is offline or not configured. */
export function fallbackRecommendations(request) {
  const {page,profile} = validateAnalyzeRequest(request);
  const issues = new Set(page.issues.map(issue => issue.type));
  const actions = [];
  const reasons = [];
  if (issues.has('small-text')) {
    actions.push({type:'SET_TEXT_SCALE', factor:clamp(Math.max(profile.fontScale, 1.2),1,1.5)});
    reasons.push('Small text was detected; increase text scale.');
  }
  if (issues.has('tight-spacing')) {
    actions.push({type:'SET_LINE_HEIGHT', ratio:clamp(Math.max(profile.lineHeight, 1.7),1.2,2)});
    reasons.push('Dense text was detected; increase line spacing.');
  }
  if (issues.has('low-contrast')) {
    actions.push({type:'BOOST_CONTRAST'});
    reasons.push('Low-contrast text was detected; improve readable foreground colors.');
  }
  if (issues.has('motion') && profile.reduceMotion) {
    actions.push({type:'REDUCE_MOTION'});
    reasons.push('The page contains motion and your profile requests reduced motion.');
  }
  if (issues.has('weak-focus') && profile.focusAssist) actions.push({type:'ENHANCE_FOCUS'});
  if ((page.category === 'article' || page.category === 'documentation') &&
      page.elements.some(element => element.role === 'main')) {
    actions.push({type:'HIGHLIGHT_MAIN',targetId:page.elements.find(el => el.role === 'main').id});
    reasons.push('The main reading region can be made easier to locate.');
  }
  if (!reasons.length) reasons.push('No strong rule-based changes were needed for this page.');
  return validateAnalyzeResponse({source:'fallback',actions,reasons},page);
}
