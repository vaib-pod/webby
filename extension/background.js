import {
  getProfile, saveProfile, listOverrides, getEffectiveProfile, saveOverride,
  getFeedbackHistory, recordFeedback, getTwin, aiConsent,setAiConsent,
  appendAnalysisHistory,analysisHistory,clearAll
} from './shared/storage.js';
import {fallbackRecommendations,validateAnalyzeResponse,validateSummary,validHostname} from './shared/contracts.js';

const API_URL = 'http://127.0.0.1:3001/api/analyze';
const allowedTab = url => /^https?:\/\//.test(url ?? '');

async function refreshTabs(hostname) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!allowedTab(tab.url)) continue;
    let tabHost;
    try {tabHost = new URL(tab.url).hostname.toLowerCase();} catch {continue;}
    if (hostname && tabHost !== hostname) continue;
    chrome.tabs.sendMessage(tab.id, {type:'PROFILE_UPDATED'}).catch(()=>{});
  }
}

async function analyzeTab(tabId) {
  if (!(await aiConsent())) throw new Error('AI analysis requires explicit consent in WEBBY settings');
  if (!Number.isInteger(tabId) || tabId < 0) throw new Error('Invalid tab');
  const tab = await chrome.tabs.get(tabId);
  if (!allowedTab(tab.url)) throw new Error('WEBBY cannot analyze this browser page');
  const hostname = new URL(tab.url).hostname.toLowerCase();
  if (!validHostname(hostname)) throw new Error('Unsupported hostname');
  const reply = await chrome.tabs.sendMessage(tabId,{type:'GET_PAGE_SUMMARY'});
  if (!reply?.ok || reply.sensitive) throw new Error('AI processing is disabled on potentially sensitive pages');
  const page = validateSummary(reply.page);
  const profile = await getEffectiveProfile(hostname);
  const request = {version:1,profile,page};
  let output;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),11000);
    let response;
    try {
      response = await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(request),signal:controller.signal});
    } finally {clearTimeout(timeout);}
    if (!response.ok) throw new Error(`Local backend HTTP ${response.status}`);
    output = validateAnalyzeResponse(await response.json(),page);
  } catch (error) {
    output = {...fallbackRecommendations(request),
      note:'Local AI server unreachable; reversible rule-based fallback used.'};
  }
  const applied = await chrome.tabs.sendMessage(tabId,{type:'APPLY_AI_ACTIONS',actions:output.actions});
  if (!applied?.ok) throw new Error('Unable to apply recommendations on this page');
  await appendAnalysisHistory({hostname,source:output.source,actionCount:applied.count ?? 0});
  return {...output,appliedCount:applied.count ?? 0};
}

async function route(message,sender) {
  if (!message || typeof message.type !== 'string') throw new Error('Invalid message');
  if (sender.id !== chrome.runtime.id) throw new Error('Unauthorized sender');
  switch (message.type) {
    case 'GET_PROFILE': return getProfile();
    case 'SAVE_PROFILE': {
      const profile = await saveProfile(message.profile);
      await refreshTabs(); return profile;
    }
    case 'GET_EFFECTIVE_PROFILE': return getEffectiveProfile(message.hostname);
    case 'SAVE_SITE_OVERRIDE': {
      const item = await saveOverride(message.override);
      await refreshTabs(item.hostname); return item;
    }
    case 'LIST_SITE_OVERRIDES': return listOverrides();
    case 'GET_FEEDBACK_HISTORY': return getFeedbackHistory();
    case 'GET_TWIN': return getTwin();
    case 'RECORD_FEEDBACK': {
      if (!validHostname(message.hostname)) throw new Error('Invalid hostname');
      const result = await recordFeedback(message.hostname,message.kind);
      await refreshTabs(message.hostname); return result;
    }
    case 'GET_AI_CONSENT': return aiConsent();
    case 'SET_AI_CONSENT': return setAiConsent(message.consent);
    case 'GET_ANALYSIS_HISTORY': return analysisHistory();
    case 'ANALYZE_WITH_AI': return analyzeTab(message.tabId);
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
