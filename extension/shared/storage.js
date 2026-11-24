import {DEFAULT_PROFILE, validateProfile, validateOverride, validHostname} from './contracts.js';
import {DEFAULT_COLOUR,validateColourPreference} from './colour.js';

const KEY = {
  profile:'webbyProfile', overrides:'webbyOverrides'
};

async function read(keys) { return chrome.storage.local.get(keys); }
export async function getColourPreference() {
  const data=await read('webbyColourPreference');
  try {return validateColourPreference(data.webbyColourPreference ?? DEFAULT_COLOUR);} catch {return {...DEFAULT_COLOUR};}
}
export async function saveColourPreference(value) {
  const clean=validateColourPreference(value);
  await chrome.storage.local.set({webbyColourPreference:clean});
  return clean;
}
export async function clearColourPreference() {
  await chrome.storage.local.remove('webbyColourPreference');
  return {...DEFAULT_COLOUR};
}
// Independent of the validated profile schema; one key per website avoids
// concurrent updates to unrelated sites overwriting each other's preferences.
export function readingToolsKey(hostname) {
  if (!validHostname(hostname)) throw new Error('Invalid hostname');
  return `webbyReadingTools:${hostname}`;
}
export async function getReadingTools(hostname) {
  const key = readingToolsKey(hostname);
  const data = (await read(key))[key];
  return {readingRuler:data?.readingRuler === true};
}
export async function saveReadingTools(hostname, value) {
  const key = readingToolsKey(hostname);
  if (!value || typeof value.readingRuler !== 'boolean' ||
      Object.keys(value).some(field => field !== 'readingRuler')) throw new Error('Invalid reading tools');
  const clean = {readingRuler:value.readingRuler};
  await chrome.storage.local.set({[key]:clean});
  return clean;
}
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
export async function clearAll() {await chrome.storage.local.clear();}
