/* WEBBY content script intentionally has no imports: Manifest V3 loads it as a classic script.
 * All mutations are local, reversible, and limited to finite accessibility changes.
 * No raw page content is ever uploaded; only an opt-in structural summary can leave the tab.
 */
(() => {
  'use strict';
  if (window.__webbyContentLoaded) return;
  window.__webbyContentLoaded = true;

  const DEFAULTS = {version:1,enabled:true,fontScale:1.1,lineHeight:1.6,
    contrastMode:'normal',darkMode:false,reduceMotion:false,focusAssist:true};
  const STYLE_TARGETS = 'p,li,td,th,figcaption,blockquote,summary,small,a,button,label,h1,h2,h3,h4,h5,h6';
  const MAX_STYLE_NODES = 1400;
  const snapshots = new WeakMap();
  const modifiedElements = new Set();
  const elementIds = new Map();
  let currentProfile = {...DEFAULTS};
  let aiActions = [];
  let liveCount = 0;
  let debounceTimer;
  let applying = false;
  let cachedCategory = 'other';

  function send(message) {
    return new Promise((resolve,reject) => {
      try {
        chrome.runtime.sendMessage(message, reply => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!reply?.ok) return reject(new Error(reply?.error || 'WEBBY service unavailable'));
          resolve(reply.data);
        });
      } catch (error) {reject(error);}
    });
  }

  function protectedElement(el) {
    if (!(el instanceof Element)) return true;
    if (el.closest('input, textarea, select, [contenteditable], [role="textbox"], [role="combobox"], code, pre, svg, canvas, video, audio, iframe, [aria-hidden="true"]')) return true;
    if (el.closest('[data-webby-exclude]')) return true;
    return el.getAttribute('type') === 'password';
  }
  function visible(el) {
    if (!el.isConnected || protectedElement(el)) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' &&
      parseFloat(style.opacity || '1') > 0.01 && el.getClientRects().length > 0;
  }
  function readColor(value) {
    if (typeof value !== 'string') return null;
    const rgba = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:[,\s\/]+([\d.]+))?\s*\)$/);
    if (!rgba) return null;
    return {r:+rgba[1],g:+rgba[2],b:+rgba[3],a:rgba[4] === undefined ? 1 : +rgba[4]};
  }
  function brightness(c) {
    const channel = n => {const v = n / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;};
    return 0.2126*channel(c.r) + 0.7152*channel(c.g) + 0.0722*channel(c.b);
  }
  function contrastRatio(first,second) {
    const a = brightness(first), b = brightness(second);
    return (Math.max(a,b) + 0.05)/(Math.min(a,b) + 0.05);
  }
  function backgroundFor(el) {
    for (let ancestor=el;ancestor && ancestor instanceof Element;ancestor=ancestor.parentElement) {
      const candidate = readColor(getComputedStyle(ancestor).backgroundColor);
      if (candidate && candidate.a > 0.97) return candidate;
      // Gradient/image backgrounds are unknown; avoid guessing foreground colors.
      if (getComputedStyle(ancestor).backgroundImage !== 'none') return null;
    }
    return {r:255,g:255,b:255,a:1};
  }
  function chooseForeground(background) {
    const black = {r:15,g:23,b:42};
    const white = {r:255,g:255,b:255};
    return contrastRatio(black,background) >= contrastRatio(white,background) ? '#0f172a' : '#ffffff';
  }
  function remember(el,property) {
    let original = snapshots.get(el);
    if (!original) {original = new Map();snapshots.set(el,original);modifiedElements.add(el);}
    if (!original.has(property)) {
      original.set(property,{value:el.style.getPropertyValue(property),priority:el.style.getPropertyPriority(property)});
    }
  }
  function setStyle(el,property,value) {
    remember(el,property);
    el.style.setProperty(property,value,'important');
  }
  function resetStyles() {
    for (const el of modifiedElements) {
      const prior = snapshots.get(el);
      if (!prior) continue;
      for (const [property,state] of prior.entries()) {
        if (state.value) el.style.setProperty(property,state.value,state.priority);
        else el.style.removeProperty(property);
      }
      snapshots.delete(el);
    }
    modifiedElements.clear();
    document.documentElement.removeAttribute('data-webby-active');
    document.documentElement.removeAttribute('data-webby-reduce-motion');
    document.documentElement.removeAttribute('data-webby-focus');
    document.documentElement.removeAttribute('data-webby-dark-mode');
    liveCount = 0;
  }
  function actionSettings() {
    const settings = {...currentProfile};
    let highlightId = null;
    for (const action of aiActions) {
      if (action.type === 'SET_TEXT_SCALE' && Number.isFinite(action.factor))
        settings.fontScale = Math.max(settings.fontScale,Math.min(action.factor,1.5));
      if (action.type === 'SET_LINE_HEIGHT' && Number.isFinite(action.ratio))
        settings.lineHeight = Math.max(settings.lineHeight,Math.min(action.ratio,2));
      if (action.type === 'BOOST_CONTRAST') settings.contrastMode = 'high';
      if (action.type === 'REDUCE_MOTION') settings.reduceMotion = true;
      if (action.type === 'ENHANCE_FOCUS') settings.focusAssist = true;
      if (action.type === 'HIGHLIGHT_MAIN') highlightId = action.targetId;
    }
    return {settings,highlightId};
  }
  function apply() {
    if (applying) return;
    applying = true;
    try {
      resetStyles();
      const {settings,highlightId} = actionSettings();
      if (!settings.enabled || !document.body) return;
      const root = document.documentElement;
      root.setAttribute('data-webby-active','1');
      root.setAttribute('data-webby-reduce-motion',settings.reduceMotion ? '1':'0');
      root.setAttribute('data-webby-focus',settings.focusAssist ? '1':'0');
      root.setAttribute('data-webby-dark-mode',settings.darkMode ? '1':'0');
      // Sample all computed styles BEFORE mutation to prevent nested text over-scaling.
      const nodes = [...document.querySelectorAll(STYLE_TARGETS)]
        .filter(visible).slice(0,MAX_STYLE_NODES);
      const baselines = nodes.map(el => {
        const css = getComputedStyle(el);
        const bg = settings.contrastMode === 'high' ? backgroundFor(el) : null;
        return {el,size:parseFloat(css.fontSize),lineHeight:parseFloat(css.lineHeight),
          foreground:readColor(css.color), bg};
      });
      for (const {el,size,foreground,bg} of baselines) {
        if (Number.isFinite(size) && size >= 8 && size <= 90 && settings.fontScale !== 1)
          setStyle(el,'font-size',`${(size * settings.fontScale).toFixed(2)}px`);
        if (['P','LI','BLOCKQUOTE','TD','TH','FIGCAPTION'].includes(el.tagName) &&
            Number.isFinite(settings.lineHeight))
          setStyle(el,'line-height',String(settings.lineHeight));
        if (bg && foreground && foreground.a > 0.97 && contrastRatio(foreground,bg) < 4.5)
          setStyle(el,'color',chooseForeground(bg));
      }
      liveCount = baselines.length;
      if (highlightId) {
        const main = elementIds.get(highlightId);
        if (main && main.isConnected && main.matches('main, [role="main"], article')) {
          setStyle(main,'outline','2px solid #0ea5e9');
          setStyle(main,'outline-offset','8px');
        }
      }
    } catch(error) {
      console.warn('[WEBBY] Could not adapt all page elements:',error);
    } finally {applying = false;}
  }
  async function reloadProfile() {
    try {
      const hostname = location.hostname.toLowerCase();
      const profile = await send({type:'GET_EFFECTIVE_PROFILE',hostname});
      currentProfile = profile;
      apply();
    } catch(error) {console.debug('[WEBBY] Profile unavailable:',error.message);}
  }
  function isSensitive() {
    if (document.querySelector('input[type="password"], input[autocomplete="cc-number"], input[autocomplete="one-time-code"]')) return true;
    if (/(?:^|\/)(?:login|signin|checkout|payment|billing|account|banking)(?:\/|$)/i.test(location.pathname)) return true;
    return false;
  }
  function classifyPage() {
    if (document.querySelector('article, [itemtype*="Article"]')) return 'article';
    if (document.querySelector('main pre, main code') && document.querySelector('nav')) return 'documentation';
    if (document.querySelector('[role="grid"], [role="table"], .dashboard, [data-dashboard]')) return 'dashboard';
    if (document.querySelector('header, nav, main')) return 'landing';
    return 'other';
  }
  function roleOf(el) {
    if (el.matches('main,article,[role="main"]')) return 'main';
    if (el.matches('h1,h2,h3,h4,h5,h6')) return 'heading';
    if (el.matches('p,blockquote')) return 'paragraph';
    if (el.matches('nav,[role="navigation"]')) return 'navigation';
    if (el.matches('button,[role="button"]')) return 'button';
    if (el.matches('img,svg,[role="img"]')) return 'image';
    return 'other';
  }
  function samplePage() {
    // Page changes can be reset while sampling; no source text, URL, form content is collected.
    resetStyles();
    const elements = [];
    const issues = [];
    elementIds.clear();
    const selector = 'main,article,h1,h2,h3,p,nav,button,img,section,[role="main"],[role="button"]';
    const candidates = [...document.querySelectorAll(selector)].filter(visible).slice(0, 30);
    for (const el of candidates) {
      const id = `e${elements.length + 1}`;
      const role = roleOf(el);
      elements.push({id,role,tag:el.tagName});
      elementIds.set(id,el);
      const css = getComputedStyle(el);
      const fontSize = parseFloat(css.fontSize);
      const lineHeight = parseFloat(css.lineHeight);
      if ((role === 'paragraph' || role === 'heading') && fontSize < 14) {
        issues.push({type:'small-text',severity:fontSize < 12 ? 'high':'medium',elementId:id});
      }
      if (role === 'paragraph' && Number.isFinite(lineHeight) && fontSize > 0 && lineHeight/fontSize < 1.35)
        issues.push({type:'tight-spacing',severity:'medium',elementId:id});
      if (['paragraph','heading','button'].includes(role)) {
        const foreground = readColor(css.color);
        const bg = backgroundFor(el);
        if (foreground && bg && foreground.a > 0.97 && contrastRatio(foreground,bg) < 4.5)
          issues.push({type:'low-contrast',severity:'medium',elementId:id});
      }
    }
    if (document.querySelector('[style*="animation"], marquee, .animated, [class*="animate"], [class*="carousel"]'))
      issues.push({type:'motion',severity:'medium'});
    if (document.querySelectorAll('a, button').length > 35) issues.push({type:'clutter',severity:'low'});
    if (document.querySelectorAll('[tabindex],button,a[href]').length > 0)
      issues.push({type:'weak-focus',severity:'low'});
    const bodyBackground = backgroundFor(document.body) ?? {r:255,g:255,b:255};
    const page = {category:classifyPage(),elements,issues:issues.slice(0,30),
      prefersDarkTheme:brightness(bodyBackground) < 0.3};
    cachedCategory = page.category;
    apply();
    return page;
  }
  function safeActions(actions) {
    if (!Array.isArray(actions)) return [];
    const result=[];
    for (const a of actions.slice(0,6)) {
      if (!a || typeof a.type !== 'string') continue;
      if (a.type === 'SET_TEXT_SCALE' && Number.isFinite(a.factor) && a.factor>=1 && a.factor<=1.5) result.push({type:a.type,factor:a.factor});
      if (a.type === 'SET_LINE_HEIGHT' && Number.isFinite(a.ratio) && a.ratio>=1.2 && a.ratio<=2) result.push({type:a.type,ratio:a.ratio});
      if (['BOOST_CONTRAST','REDUCE_MOTION','ENHANCE_FOCUS'].includes(a.type)) result.push({type:a.type});
      if (a.type === 'HIGHLIGHT_MAIN' && typeof a.targetId === 'string' && elementIds.get(a.targetId)?.matches('main,article,[role="main"]'))
        result.push({type:a.type,targetId:a.targetId});
    }
    return result;
  }
  chrome.runtime.onMessage.addListener((message,_sender,reply) => {
    if (!message || typeof message.type !== 'string') return false;
    if (message.type === 'PROFILE_UPDATED') {
      reloadProfile().then(()=>reply({ok:true})); return true;
    }
    if (message.type === 'GET_STATUS') {
      reply({ok:true, data:{enabled:currentProfile.enabled, modifiedNodes:liveCount,
        category:cachedCategory, sensitive:isSensitive(), hostname:location.hostname}}); return false;
    }
    if (message.type === 'GET_PAGE_SUMMARY') {
      if (isSensitive()) {reply({ok:true,sensitive:true});return false;}
      reply({ok:true,sensitive:false,page:samplePage()});return false;
    }
    if (message.type === 'APPLY_AI_ACTIONS') {
      const actions = safeActions(message.actions);
      aiActions = actions;
      apply();
      reply({ok:true,count:actions.length});return false;
    }
    return false;
  });
  const observer = new MutationObserver(mutations => {
    if (applying || !currentProfile.enabled || !mutations.some(m => m.addedNodes.length)) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(apply,400);
  });
  if (document.documentElement) observer.observe(document.documentElement,{childList:true,subtree:true});
  // chrome.storage events reach content scripts even when the service worker cannot
  // read another tab's URL. This guarantees saved preferences apply immediately.
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area === 'local' && (changes.webbyProfile || changes.webbyOverrides)) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(reloadProfile,70);
    }
  });
  reloadProfile();
})();
