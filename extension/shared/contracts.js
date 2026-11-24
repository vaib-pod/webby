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

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

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

