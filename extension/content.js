/* WEBBY content script intentionally has no imports: Manifest V3 loads it as a classic script.
 * All mutations are local, reversible, and limited to finite accessibility changes.
 * Reading text is extracted only for a manual preview.
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
  let currentProfile = {...DEFAULTS};
  let colourContext = null;
  let profileRevision = 0;
  let debounceTimer;
  let applying = false;
  let ruler = null;
  let rulerEvents = null;
  let rulerFrame = 0;
  let rulerY = innerHeight / 2;
  let rulerFocus = null;
  let reader = null;
  let readingToolsRevision = 0;

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
      // Gradient/image backgrounds are unknown; avoid guessing foreground colors.
      if (getComputedStyle(ancestor).backgroundImage !== 'none') return null;
      const candidate = readColor(getComputedStyle(ancestor).backgroundColor);
      if (candidate && candidate.a > 0.97) return candidate;
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
    // Restoring a font can start a page transition. Disable transitions while
    // sampling so computed sizes reflect the original CSS, not the last scale.
    document.documentElement.setAttribute('data-webby-updating','1');
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
    document.documentElement.removeAttribute('data-webby-calm');
    document.documentElement.removeAttribute('data-webby-colour');
  }
  // Match the Calm preset using the same saved controls as the popup.
  function isCalm(settings) {
    return settings.enabled && !settings.darkMode && settings.contrastMode === 'normal' &&
      settings.reduceMotion && settings.focusAssist && settings.fontScale === 1.15 && settings.lineHeight === 1.75;
  }
  function lightNeutral(color) {
    return color && color.a > .97 && Math.min(color.r,color.g,color.b) >= 200 &&
      Math.max(color.r,color.g,color.b) - Math.min(color.r,color.g,color.b) <= 35;
  }
  function applyCalmAppearance() {
    // Sample before changing surfaces; preserve colored controls, imagery and dark panels.
    const samples = [document.documentElement,document.body,
      ...document.body.querySelectorAll('*')].slice(0,MAX_STYLE_NODES).filter(visible).map(el => {
      const css = getComputedStyle(el);
      return {el,background:readColor(css.backgroundColor),image:css.backgroundImage,
        foreground:readColor(css.color),surface:backgroundFor(el)};
    });
    for (const {el,background,image,foreground,surface} of samples) {
      if (image === 'none' && (lightNeutral(background) ||
          (el === document.body && background?.a === 0 && lightNeutral(surface)))) {
        setStyle(el,'background-color',el === document.body || el === document.documentElement ? '#f5eddf' : '#fbf4e8');
      }
      if (!el.closest('a[href]') && lightNeutral(surface) && foreground?.a > .97 &&
          Math.max(foreground.r,foreground.g,foreground.b) < 150 &&
          Math.max(foreground.r,foreground.g,foreground.b) - Math.min(foreground.r,foreground.g,foreground.b) <= 35) {
        setStyle(el,'color','#51483e');
      }
    }
  }
  function apply() {
    if (applying) return;
    applying = true;
    try {
      resetStyles();
      const settings = currentProfile;
      if (!settings.enabled || !document.body || document.documentElement.hasAttribute('data-webby-assessment')) return;
      const root = document.documentElement;
      root.setAttribute('data-webby-active','1');
      root.setAttribute('data-webby-reduce-motion',settings.reduceMotion ? '1':'0');
      root.setAttribute('data-webby-focus',settings.focusAssist ? '1':'0');
      root.setAttribute('data-webby-dark-mode',settings.darkMode ? '1':'0');
      root.setAttribute('data-webby-calm',isCalm(settings) ? '1':'0');
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
        // Preserve the website's link-state colours; inline overrides erase visited distinctions.
        if (!el.closest('a[href]') && bg && foreground && foreground.a > 0.97 && contrastRatio(foreground,bg) < 4.5)
          setStyle(el,'color',chooseForeground(bg));
      }
      if (isCalm(settings)) applyCalmAppearance();
      window.__webbyColourAdaptation?.apply({context:colourContext,settings,setStyle,readColor,backgroundFor,contrastRatio,chooseForeground});
    } catch(error) {
      console.warn('[WEBBY] Could not adapt all page elements:',error);
    } finally {
      // Commit the final styles before restoring the page's transitions.
      const root = document.documentElement;
      root.getBoundingClientRect();
      root.removeAttribute('data-webby-updating');
      applying = false;
      updateReaderAppearance();
      observer.takeRecords();
    }
  }
  async function reloadProfile() {
    const revision=++profileRevision;
    try {
      const hostname = location.hostname.toLowerCase();
      const [profile,colour] = await Promise.all([
        send({type:'GET_EFFECTIVE_PROFILE',hostname}),
        window.__webbyColourAdaptation ? send({type:'GET_COLOUR_CONTEXT'}).catch(()=>null) : null
      ]);
      if(revision!==profileRevision)return;
      currentProfile = profile;
      colourContext = colour;
      apply();
    } catch(error) {console.debug('[WEBBY] Profile unavailable:',error.message);}
  }
  function isSensitive() {
    if (document.querySelector('input[type="password"], input[autocomplete="cc-number"], input[autocomplete="one-time-code"]')) return true;
    if (/(?:^|\/)(?:login|signin|checkout|payment|billing|account|banking)(?:\/|$)/i.test(location.pathname)) return true;
    return false;
  }
  function toolsStatus() {
    return {readingRuler:Boolean(ruler?.isConnected),focusReading:Boolean(reader?.dialog.open),sensitive:isSensitive()};
  }
  function notifyTools() {
    send({type:'READING_TOOLS_STATE',data:toolsStatus()}).catch(()=>{});
  }
  function positionRuler() {
    if (!ruler || rulerFrame) return;
    rulerFrame = requestAnimationFrame(() => {
      rulerFrame = 0;
      if (!ruler) return;
      if (rulerFocus?.isConnected) {
        const rect = rulerFocus.getBoundingClientRect();
        rulerY = rect.top + Math.min(rect.height,56) / 2;
      }
      rulerY = Math.max(28,Math.min(innerHeight - 28,rulerY));
      ruler.style.setProperty('transform',`translateY(${Math.round(rulerY - 28)}px)`,'important');
    });
  }
  function raiseRuler() {
    if (ruler?.showPopover) {
      if (ruler.matches(':popover-open')) ruler.hidePopover();
      ruler.showPopover();
    }
  }
  function setRuler(enabled) {
    if (Boolean(ruler) === enabled) return;
    if (!enabled) {
      rulerEvents?.abort(); rulerEvents = null;
      cancelAnimationFrame(rulerFrame); rulerFrame = 0;
      ruler?.remove(); ruler = null; rulerFocus = null;
      return;
    }
    ruler = document.createElement('div');
    ruler.setAttribute('data-webby-ruler','');
    ruler.setAttribute('data-webby-exclude','');
    ruler.setAttribute('aria-hidden','true');
    // A noninteractive top-layer element stays fixed even on pages with the
    // existing whole-page dark-mode filter, and can appear above the reader.
    ruler.setAttribute('popover','manual');
    document.documentElement.append(ruler);
    raiseRuler();
    rulerEvents = new AbortController();
    const options = {passive:true,signal:rulerEvents.signal};
    document.addEventListener('pointermove',event => {
      rulerFocus = null; rulerY = event.clientY; positionRuler();
    },options);
    document.addEventListener('focusin',event => {
      const target = event.composedPath()[0];
      if (target instanceof Element) {rulerFocus = target;positionRuler();}
    },options);
    document.addEventListener('scroll',positionRuler,{...options,capture:true});
    window.addEventListener('resize',positionRuler,options);
    positionRuler();
  }
  async function reloadReadingTools() {
    const revision = ++readingToolsRevision;
    try {
      const state = await send({type:'GET_READING_TOOLS',hostname:location.hostname.toLowerCase()});
      if (revision === readingToolsRevision) {setRuler(state.readingRuler === true);notifyTools();}
    } catch { /* Existing adaptation still works if an older background is loaded. */ }
  }
  const READER_EXCLUDED = 'script,style,noscript,template,form,input,textarea,select,button,iframe,object,embed,video,audio,canvas,svg,img,nav,footer,aside,[role="navigation"],[role="banner"],[role="complementary"],[role="dialog"],[role="textbox"],[hidden],[inert],[contenteditable],[aria-hidden="true"],[data-webby-exclude],[class~="ad"],[class~="ads"],[class*="advert"],[id^="ad-"],[aria-label*="advertisement" i]';
  const READER_TAGS = new Set(['H1','H2','H3','H4','H5','H6','P','UL','OL','LI','DL','DT','DD','BLOCKQUOTE','A','STRONG','EM','B','I','U','S','CODE','PRE','BR','HR','TABLE','THEAD','TBODY','TFOOT','TR','TD','TH','CAPTION','FIGCAPTION','SUP','SUB']);
  function readerVisible(el) {
    const css = getComputedStyle(el);
    return css.display !== 'none' && css.visibility !== 'hidden' && css.visibility !== 'collapse' &&
      Number(css.opacity) > 0.01 && (css.display === 'contents' || el.getClientRects().length > 0);
  }
  function readerSourceVisible(el) {
    for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
      if (!readerVisible(ancestor)) return false;
    }
    return true;
  }
  function extractReader() {
    // No innerHTML, cloning, original attributes or event handlers. Only fresh
    // allowlisted elements and text nodes enter the isolated reader.
    const candidates = [...document.querySelectorAll('article,main,[role="main"]')]
      .filter(el => !el.closest(READER_EXCLUDED) && readerSourceVisible(el)).slice(0,12);
    let best = null;
    for (const source of candidates) {
      const fragment = document.createDocumentFragment();
      const ids = new Map(), links = [], positions = [];
      let nodes = 0, characters = 0;
      function copy(node, parent, depth = 0) {
        if (++nodes > 12000 || depth > 60 || characters >= 150000) return;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.slice(0,150000 - characters);
          characters += text.length; parent.append(document.createTextNode(text)); return;
        }
        if (!(node instanceof Element) || node.matches(READER_EXCLUDED) || !readerVisible(node)) return;
        let element = parent;
        if (READER_TAGS.has(node.tagName)) {
          element = document.createElement(node.tagName.toLowerCase());
          parent.append(element);
          if (node.id) {
            const id = `webby-section-${ids.size}`;
            if (!ids.has(node.id)) {ids.set(node.id,id);element.id=id;}
          }
          if (node.tagName === 'A') {
            try {
              const url = new URL(node.getAttribute('href'),document.baseURI);
              if (node.hasAttribute('href') && ['https:','http:','mailto:'].includes(url.protocol)) {
                element.href = url.href;
                element.target = '_blank'; element.rel = 'noopener noreferrer';
                links.push({element,url});
              }
            } catch { /* Invalid and executable URLs are rendered as plain text. */ }
          }
          if (/^(H[1-6]|P|LI|PRE)$/.test(node.tagName)) positions.push({source:node,element});
        }
        for (const child of node.childNodes) copy(child,element,depth + 1);
      }
      for (const child of source.childNodes) copy(child,fragment);
      const text = fragment.textContent.replace(/\s+/g,' ').trim();
      if (text.length < 160 || !fragment.querySelector('p,li,pre,blockquote')) continue;
      for (const {element,url} of links) {
        if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash) {
          let id;
          try {id = ids.get(decodeURIComponent(url.hash.slice(1)));} catch {continue;}
          if (id) {
            element.href = `#${id}`; element.removeAttribute('target');
            element.addEventListener('click',event => {
              event.preventDefault();
              const target = element.getRootNode().getElementById(id);
              target?.scrollIntoView({block:'start',behavior:'instant'});
              if (target) {target.tabIndex=-1;target.focus({preventScroll:true});}
            });
          }
        }
      }
      const result = {fragment,positions,length:text.length,truncated:characters >= 150000 || nodes > 12000};
      if (!best || result.length > best.length) best = result;
    }
    if (!best) throw new Error('No suitable article was found. Try a page with a main article, blog post or documentation section.');
    return best;
  }
  const READER_CSS = `
    :host { all:initial !important; display:contents !important; }
    dialog { display:block; position:fixed; inset:0; margin:0; padding:0; border:0;
      width:100vw; height:100vh; max-width:none; max-height:none;
      overflow:auto; overscroll-behavior:contain; color-scheme:light;
      background:var(--reader-bg,#eaf5e3); color:var(--reader-ink,#173d21);
      font-family:system-ui,-apple-system,'Segoe UI',sans-serif; text-align:left; }
    *, *::before, *::after { box-sizing:border-box; }
    .toolbar { position:sticky; top:0; z-index:1; background:var(--reader-card,#fffefc);
      color:var(--reader-ink,#173d21); border-bottom:1px solid #9bb991; padding:14px 20px;
      display:flex; align-items:center; justify-content:space-between; gap:16px; font-size:16px; }
    button { font:inherit; background:var(--reader-button,#267334); color:white; padding:10px 16px; border:2px solid transparent;
      border-radius:12px; cursor:pointer; font-weight:700; }
    button:hover { background:var(--reader-button-hover,#1e5d2a); }
    :focus-visible { outline:3px solid var(--reader-focus,#a54e0e); outline-offset:4px; }
    article { max-width:760px; margin:28px auto 60px; padding:28px 32px; border-radius:18px;
      background:var(--reader-card,#fffefc); color:var(--reader-ink,#173d21);
      font-size:var(--reader-size,22px); line-height:var(--reader-line,1.6); overflow-wrap:anywhere; }
    p, ul, ol, dl, pre, blockquote, table { margin:0 0 1.2em; }
    h1,h2,h3,h4,h5,h6 { line-height:1.3; margin:1.4em 0 .6em; scroll-margin-top:100px; }
    h1 { font-size:1.7em; } h2 { font-size:1.4em; } h3 { font-size:1.2em; }
    li { margin:.4em 0; } blockquote { border-left:4px solid var(--reader-border,#8ebd7e); padding-left:1em; }
    a { color:var(--reader-link,#1d642e); text-decoration:underline; text-underline-offset:.15em; }
    pre { white-space:pre-wrap; } code { font-size:.9em; }
    table { border-collapse:collapse; display:block; overflow-x:auto; }
    th,td { border:1px solid var(--reader-border,#9bb991); padding:.4em; }
    .hint { font-size:14px; } :focus { scroll-margin-top:100px; }
    @media(max-width:800px) { article { margin:16px 12px 40px; padding:22px 18px; } }
    @media(prefers-reduced-motion:reduce) { * { scroll-behavior:auto; } }
  `;
  function updateReaderAppearance() {
    if (!reader) return;
    const settings = currentProfile;
    const dark = settings.darkMode && settings.enabled;
    const high = settings.contrastMode === 'high';
    const calm = isCalm(settings);
    const values = {'--reader-size':`${20 * settings.fontScale}px`,'--reader-line':settings.lineHeight,
      '--reader-bg':dark ? '#132019' : calm ? '#f5eddf' : '#eaf5e3',
      '--reader-card':dark ? '#1b2d21' : calm ? '#fbf4e8' : '#fffefc',
      '--reader-ink':dark ? '#ffffff' : high ? '#000000' : calm ? '#51483e' : '#173d21',
      '--reader-link':dark ? '#b7f5a4' : calm ? '#80552c' : '#1d642e',
      '--reader-focus':dark ? '#ffcc80' : '#a54e0e',
      '--reader-button':calm ? '#80552c' : '#267334','--reader-button-hover':calm ? '#654120' : '#1e5d2a',
      '--reader-border':calm ? '#c6ad86' : '#9bb991'};
    for (const [key,value] of Object.entries(values)) reader.dialog.style.setProperty(key,String(value));
  }
  function closeReader() {
    if (!reader) return;
    const previous = reader; reader = null;
    previous.events.abort();
    previous.dialog.close(); previous.host.remove();
    if (previous.focus?.isConnected && !previous.focus.closest('[inert]')) previous.focus.focus({preventScroll:true});
    window.scrollTo({left:previous.x,top:previous.y,behavior:'instant'});
    raiseRuler(); positionRuler(); notifyTools();
  }
  function openReader() {
    if (reader) return;
    if (isSensitive()) throw new Error('Focus Reading Mode is disabled on potentially sensitive pages.');
    const extracted = extractReader();
    const host = document.createElement('div');
    host.setAttribute('data-webby-reader','');host.setAttribute('data-webby-exclude','');
    const shadow = host.attachShadow({mode:'open'});
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label','WEBBY Focus Reading Mode');
    const style = document.createElement('style');style.textContent = READER_CSS;
    const toolbar = document.createElement('div');toolbar.className='toolbar';
    const label = document.createElement('strong');label.textContent='WEBBY · Focus Reading';
    const exit = document.createElement('button');exit.textContent='Exit Reading Mode';exit.type='button';
    toolbar.append(label,exit);
    const article = document.createElement('article');article.append(extracted.fragment);
    if (extracted.truncated) {
      const hint = document.createElement('p');hint.className='hint';
      hint.textContent='This very long article was shortened for reading mode. Exit to read the full page.';article.append(hint);
    }
    dialog.append(toolbar,article);shadow.append(style,dialog);
    let focus = document.activeElement;
    while (focus?.shadowRoot?.activeElement) focus = focus.shadowRoot.activeElement;
    const events = new AbortController();
    const position = extracted.positions.find(item => {
      const rect = item.source.getBoundingClientRect();return rect.bottom > 0 && rect.top < innerHeight;
    });
    reader = {host,dialog,events,focus,x:scrollX,y:scrollY};
    updateReaderAppearance();document.documentElement.append(host);
    const options = {signal:events.signal};
    exit.addEventListener('click',closeReader,options);
    dialog.addEventListener('cancel',event => {event.preventDefault();closeReader();},options);
    dialog.addEventListener('close',closeReader,options);
    dialog.addEventListener('keydown',event => {
      if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();closeReader();return;}
      if (event.key !== 'Tab') return;
      const focusable = [...shadow.querySelectorAll('button,a[href]')];
      const active = shadow.activeElement;
      if (event.shiftKey && (active === focusable[0] || !focusable.includes(active))) {
        event.preventDefault();focusable.at(-1).focus();
      } else if (!event.shiftKey && active === focusable.at(-1)) {event.preventDefault();focusable[0].focus();}
    },options);
    window.addEventListener('pagehide',closeReader,options);
    try {
      dialog.showModal();exit.focus({preventScroll:true});
      if (position) dialog.scrollTop = Math.max(0,position.element.getBoundingClientRect().top - dialog.getBoundingClientRect().top - 100);
      raiseRuler();notifyTools();
    } catch(error) {closeReader();throw error;}
  }
  function readingText() {
    const root = document.querySelector('article, main, [role="main"]') || document.body;
    if (!root) return {text:'',truncated:false};
    const excluded = 'script,style,noscript,template,form,input,textarea,select,button,nav,footer,aside,[hidden],[inert],[contenteditable],[aria-hidden="true"],[data-webby-exclude]';
    if (root.closest(excluded)) return {text:'',truncated:false};
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          return node.closest(excluded) || !visible(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
        }
        return node.parentElement && !node.parentElement.closest(excluded) && visible(node.parentElement)
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    let text = '', node;
    while ((node = walker.nextNode())) {
      const part = node.textContent.replace(/\s+/g,' ').trim();
      if (!part) continue;
      text += `${text ? ' ' : ''}${part}`;
      if (text.length > 12000) return {text:text.slice(0,12000),truncated:true};
    }
    return {text,truncated:false};
  }
  chrome.runtime.onMessage.addListener((message,_sender,reply) => {
    if (!message || typeof message.type !== 'string') return false;
    if (_sender.id !== chrome.runtime.id) return false;
    if (message.type === 'SET_FOCUS_READING') {
      try {
        if (typeof message.enabled !== 'boolean') throw new Error('Invalid reading mode state');
        if (message.enabled) openReader(); else closeReader();
        reply({ok:true,data:toolsStatus()});
      } catch(error) {reply({ok:false,error:error.message});}
      return false;
    }
    if (message.type === 'READING_TOOLS_UPDATED') {
      reloadReadingTools().then(()=>reply({ok:true,data:toolsStatus()}));return true;
    }
    if (message.type === 'GET_READING_TEXT') {
      if (isSensitive()) {reply({ok:false,error:'Reading features are disabled on potentially sensitive pages.'});return false;}
      reply({ok:true,...readingText()});return false;
    }
    if (message.type === 'PROFILE_UPDATED') {
      reloadProfile().then(()=>reply({ok:true})); return true;
    }
    if (message.type === 'GET_STATUS') {
      reply({ok:true, data:{...toolsStatus()}}); return false;
    }
    return false;
  });
  const observer = new MutationObserver(mutations => {
    if (applying || !currentProfile.enabled || !mutations.some(m =>
      !m.target.closest?.('[data-webby-exclude]') && (m.type==='attributes' || [...m.addedNodes].some(node =>
        !(node instanceof Element && node.matches('[data-webby-exclude]')))))) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(apply,400);
  });
  if (document.documentElement) observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,
    attributeFilter:['class','aria-selected','aria-pressed','aria-current','aria-invalid','disabled']});
  // chrome.storage events reach content scripts even when the service worker cannot
  // read another tab's URL. This guarantees saved preferences apply immediately.
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area === 'local' && changes[`webbyReadingTools:${location.hostname.toLowerCase()}`]) reloadReadingTools();
    if (area === 'local' && (changes.webbyProfile || changes.webbyOverrides || changes.webbyColourPreference)) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(reloadProfile,70);
    }
  });
  reloadProfile();
  reloadReadingTools();
})();
