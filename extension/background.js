import {
  getProfile, saveProfile, listOverrides, getEffectiveProfile, saveOverride,
  clearAll,getReadingTools,saveReadingTools,getColourPreference,saveColourPreference,clearColourPreference
} from './shared/storage.js';
import {paletteById} from './shared/colour.js';
import {getAccessibilityTwin} from './shared/twin.js';

const allowedTab = url => /^https?:\/\//.test(url ?? '');

async function refreshTabs(hostname, type = 'PROFILE_UPDATED') {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!allowedTab(tab.url)) continue;
    let tabHost;
    try {tabHost = new URL(tab.url).hostname.toLowerCase();} catch {continue;}
    if (hostname && tabHost !== hostname) continue;
    await chrome.tabs.sendMessage(tab.id, {type}).catch(()=>{});
  }
}

async function route(message,sender) {
  if (!message || typeof message.type !== 'string') throw new Error('Invalid message');
  if (sender.id !== chrome.runtime.id) throw new Error('Unauthorized sender');
  switch (message.type) {
    case 'GET_ACCESSIBILITY_TWIN': return getAccessibilityTwin(message.hostname);
    case 'GET_COLOUR_PREFERENCE': return getColourPreference();
    case 'GET_COLOUR_CONTEXT': {
      const preference=await getColourPreference();
      return {preference,palette:paletteById(preference.paletteId)};
    }
    case 'SAVE_COLOUR_PREFERENCE': {
      const preference=await saveColourPreference(message.preference);
      await refreshTabs(); return preference;
    }
    case 'CLEAR_COLOUR_PREFERENCE': {
      const preference=await clearColourPreference();
      await refreshTabs(); return preference;
    }
    case 'GET_PROFILE': return getProfile();
    case 'SAVE_PROFILE': {
      const profile = await saveProfile(message.profile);
      await refreshTabs(); return profile;
    }
    case 'GET_EFFECTIVE_PROFILE': return getEffectiveProfile(message.hostname);
    case 'GET_READING_TOOLS': return getReadingTools(message.hostname);
    case 'SAVE_READING_TOOLS': {
      const state = await saveReadingTools(message.hostname,message.state);
      await refreshTabs(message.hostname,'READING_TOOLS_UPDATED'); return state;
    }
    case 'SAVE_SITE_OVERRIDE': {
      const item = await saveOverride(message.override);
      await refreshTabs(item.hostname); return item;
    }
    case 'LIST_SITE_OVERRIDES': return listOverrides();
    case 'CLEAR_ALL': await clearAll(); await refreshTabs(); return true;
    default: throw new Error('Unsupported message type');
  }
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse) => {
  route(message,sender).then(data=>sendResponse({ok:true,data}))
    .catch(error=>sendResponse({ok:false,error:error.message || 'Unknown error'}));
  return true;
});
chrome.runtime.onInstalled.addListener(()=>console.log('[WEBBY] installed: open extension popup to get started'));

// Remove locally cached reading previews and summaries when their source tab closes.
chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.session.remove(`webbyReadingSession:${tabId}`).catch(()=>{});
});

// A draft belongs to the URL it came from, never a later page in that tab.
chrome.tabs.onUpdated.addListener((tabId,changeInfo) => {
  if (!changeInfo.url) return;
  const key=`webbyReadingSession:${tabId}`;
  chrome.storage.session.get(key).then(data => {
    if (data[key] && data[key].pageUrl !== changeInfo.url) return chrome.storage.session.remove(key);
  }).catch(()=>{});
});
