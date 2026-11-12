import {DEFAULT_PROFILE, validateProfile, validateOverride, validHostname, FEEDBACK_KINDS} from './contracts.js';
import {learnFromFeedback, summariseTwin} from './twin.js';

const KEY = {
  profile:'webbyProfile', overrides:'webbyOverrides', feedback:'webbyFeedback',
  consent:'webbyAiConsent', history:'webbyAnalysisHistory'
};

async function read(keys) { return chrome.storage.local.get(keys); }
export async function getProfile() {
  const data = await read(KEY.profile);
  try {return validateProfile(data[KEY.profile] ?? DEFAULT_PROFILE);} catch {return {...DEFAULT_PROFILE};}
}
export async function saveProfile(profile) {
  const clean = validateProfile(profile);
  await chrome.storage.local.set({[KEY.profile]:clean});
  return clean;
}
export async function listOverrides() {
  const data = await read(KEY.overrides);
  return (Array.isArray(data[KEY.overrides]) ? data[KEY.overrides] : []).flatMap(entry => {
    try {return [validateOverride(entry)];} catch {return [];}
  }).slice(0, 500);
}
export async function getEffectiveProfile(hostname) {
  const base = await getProfile();
  if (!validHostname(hostname)) return base;
  const override = (await listOverrides()).find(item => item.hostname === hostname);
  return validateProfile({...base,...(override?.patch ?? {})});
}
export async function saveOverride(override) {
  const clean = validateOverride(override);
  const list = (await listOverrides()).filter(item => item.hostname !== clean.hostname);
  if (Object.keys(clean.patch).length) list.push(clean);
  await chrome.storage.local.set({[KEY.overrides]:list.slice(-500)});
  return clean;
}
export async function getFeedbackHistory() {
  const data = await read(KEY.feedback);
  return (Array.isArray(data[KEY.feedback]) ? data[KEY.feedback] : [])
    .filter(item => item && validHostname(item.hostname) && FEEDBACK_KINDS.includes(item.kind) &&
      Number.isFinite(Date.parse(item.timestamp))).slice(-250);
}
export async function recordFeedback(hostname, kind) {
  if (!validHostname(hostname) || !FEEDBACK_KINDS.includes(kind)) throw new Error('Invalid feedback');
  const base = await getProfile();
  const overrides = await listOverrides();
  const old = overrides.find(item => item.hostname === hostname);
  const patch = learnFromFeedback(base, old?.patch ?? {}, kind);
  const override = await saveOverride({hostname,updatedAt:new Date().toISOString(),patch});
  const entry = {id:crypto.randomUUID(), hostname,kind,timestamp:new Date().toISOString()};
  const history = await getFeedbackHistory();
  history.push(entry);
  await chrome.storage.local.set({[KEY.feedback]:history.slice(-250)});
  return {override,entry,effectiveProfile:await getEffectiveProfile(hostname)};
}
export async function getTwin() {return summariseTwin(await listOverrides(), await getFeedbackHistory());}
export async function aiConsent() {return (await read(KEY.consent))[KEY.consent] === true;}
export async function setAiConsent(value) {
  if (typeof value !== 'boolean') throw new Error('Invalid AI consent');
  await chrome.storage.local.set({[KEY.consent]:value}); return value;
}
export async function appendAnalysisHistory(entry) {
  if (!validHostname(entry.hostname) || !['ai','fallback'].includes(entry.source)) throw new Error('Invalid analysis');
  const data = await read(KEY.history);
  const list = Array.isArray(data[KEY.history]) ? data[KEY.history] : [];
  list.push({hostname:entry.hostname, source:entry.source, actionCount:entry.actionCount,
    timestamp:new Date().toISOString()});
  await chrome.storage.local.set({[KEY.history]:list.slice(-50)});
}
export async function analysisHistory() {return (await read(KEY.history))[KEY.history] ?? [];}
export async function clearAll() {await chrome.storage.local.clear();}
