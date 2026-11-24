/* Classic MV3 helper. The existing content controller owns snapshots and updates. */
(() => {
  'use strict';
  const EXCLUDED='img,picture,video,audio,canvas,svg,iframe,object,embed,header,nav,footer,aside,[role="search"],[role="navigation"],[role="searchbox"],[contenteditable],[role="img"],[data-webby-exclude],[data-webby-assessment]';
  // Avoid affecting search/navigation chrome; links are only marked in prose.
  const SEARCH_UI='[role="search"],[role="searchbox"],form[action*="/search"],header,nav,footer,aside,[class~="search"],[id~="search"],.search-box,.search-results,.search-result,[data-testid*="search"]';
  const PROSE='p,li,blockquote,figcaption';
  const TARGETS='p,li,td,th,figcaption,blockquote,summary,small,a,button,label,h1,h2,h3,h4,h5,h6,[role="button"],[role="alert"],[role="status"],[aria-selected="true"],[aria-pressed="true"],[aria-current],[data-webby-chart-series]';
  window.__webbyColourAdaptation = {
    apply({context,settings,setStyle,readColor,backgroundFor,contrastRatio,chooseForeground}) {
      if (!context?.preference?.enabled || !context.preference.userConfirmed || !settings.enabled ||
          document.documentElement.hasAttribute('data-webby-assessment') || location.protocol==='chrome-extension:') return;
      const palette=context.palette;
      if (!palette || ![palette.ink,palette.surface,palette.action,palette.accent,palette.notice,...(palette.series||[])].every(value=>/^#[0-9a-f]{6}$/i.test(value))) return;
      document.documentElement.setAttribute('data-webby-colour','1');
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT,{
        acceptNode:node=>node.matches(EXCLUDED+','+SEARCH_UI) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      });
      const nodes=[];
      let node=walker.currentNode, visited=0;
      // Bound work on very large pages. All changes use the existing undo mechanism.
      while(node && visited++<5000 && nodes.length<1400){
        if(node.matches(TARGETS) && !node.closest(EXCLUDED) && !node.closest(SEARCH_UI) && node.getClientRects().length)nodes.push(node);
        node=walker.nextNode();
      }
      const samples=nodes.map(el=>{const css=getComputedStyle(el);return {el,css:{color:css.color,backgroundImage:css.backgroundImage},bg:backgroundFor(el)};});
      const colouredSurfaces=new Map();
      for(const {el,css,bg} of samples){
        const link=el.matches('a[href]');
        const insideLink=Boolean(el.closest('a[href]'));
        const control=el.matches('button,[role="button"]');
        const notice=el.matches('[role="alert"],[role="status"]');
        const selected=el.matches('[aria-selected="true"],[aria-pressed="true"],[aria-current]:not([aria-current="false"])');
        if(link && el.closest(PROSE) && !el.closest(SEARCH_UI)){
          setStyle(el,'text-decoration-line','underline');
          setStyle(el,'text-underline-offset','0.18em');
          setStyle(el,'text-decoration-thickness','0.12em');
        }
        if(selected){setStyle(el,'outline','3px double currentColor');setStyle(el,'outline-offset','2px');}
        if(notice){setStyle(el,'border-inline-start','5px double currentColor');}
        // Apply the palette in both modes. The existing dark filter transforms it
        // with the page; it must not silently disable the user's colour preference.
        const parentSurface=el.parentElement?.closest('button,[role="button"],[role="alert"],[role="status"]');
        const inheritedInk=colouredSurfaces.get(parentSurface);
        const fg=readColor(css.color);
        // Keep the site's link/visited/hover colours, including nested result titles.
        // A shared inline colour would make every link look like the same state.
        if(!insideLink){
          if(inheritedInk)setStyle(el,'color',inheritedInk);
          else if(bg && fg?.a>.97 && contrastRatio(fg,bg)<4.5)setStyle(el,'color',chooseForeground(bg));
        }
        // Preserve background imagery and complex translucent/gradient surfaces.
        if(css.backgroundImage!=='none')continue;
        if((control || notice) && !insideLink){
          // Preserve currentColor-based artwork inside a control before changing
          // the surrounding text/surface. Images and hard-coded fills stay intact.
          for(const media of [...el.querySelectorAll('svg,[role="img"]')].slice(0,100))setStyle(media,'color',getComputedStyle(media).color);
        }
        if(control && !insideLink){
          setStyle(el,'background-color',palette.action);setStyle(el,'color','#ffffff');
          setStyle(el,'border-color',palette.action);
          colouredSurfaces.set(el,'#ffffff');
          for(const child of [...el.querySelectorAll('p,span,strong,em,small,label')].slice(0,100)){
            if(!child.closest(EXCLUDED) && !child.closest('a[href]'))setStyle(child,'color','#ffffff');
          }
        } else if(notice && !insideLink){
          setStyle(el,'background-color',palette.notice);setStyle(el,'color',palette.ink);
          colouredSurfaces.set(el,palette.ink);
          // Make notice children inherit a readable colour without changing text or roles.
          for(const child of [...el.querySelectorAll('p,span,strong,em,a')].slice(0,100)){
            if(!child.closest(EXCLUDED) && !child.closest('a[href]'))setStyle(child,'color',palette.ink);
          }
        }
        // Only opt-in HTML chart series with explicit labels; never infer SVG/canvas semantics.
        const series=el.getAttribute('data-webby-chart-series');
        if(series!==null && /^[0-2]$/.test(series) && el.getAttribute('aria-label') &&
            !el.children.length && !el.textContent.trim()){
          const index=Number(series);
          setStyle(el,'background-color',palette.series[index]);
          setStyle(el,'background-image',index===0?'none':index===1?
            'repeating-linear-gradient(45deg,transparent 0 6px,#ffffff 6px 8px)':
            'repeating-linear-gradient(0deg,transparent 0 5px,#ffffff 5px 7px)');
          setStyle(el,'border','2px solid #202020');
        }
      }
    }
  };
})();
