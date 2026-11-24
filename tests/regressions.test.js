import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const file=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('colour adaptation underlines prose links without changing search, navigation or search-form controls',async()=>{
  const styles=[];
  const body={id:'body',tag:'BODY',parent:null,matches:()=>false,closest:()=>null,getClientRects:()=>[1],getAttribute:()=>null,querySelector:()=>null,querySelectorAll:()=>[],children:[],textContent:''};
  const nodes=[body];
  function element(id,tag,parent,extra={}){
    const node={id,tag,parent,extra,
      matches(selector){return selector.split(',').some(item=>{
        item=item.trim();
        if(item==='a[href]')return tag==='A'&&!!extra.href;
        if(item==='[role="button"]')return extra.role==='button';
        if(item==='[role="alert"]')return extra.role==='alert';
        if(item==='[role="status"]')return extra.role==='status';
        if(item==='[data-webby-chart-series]')return extra.chart;
        if(item==='[role="search"]')return extra.role==='search';
        if(item==='[role="navigation"]')return extra.role==='navigation';
        if(item==='[class~="search"]')return extra.classes?.includes('search');
        if(item==='.search-results')return extra.classes?.includes('search-results');
        if(item==='.search-result')return extra.classes?.includes('search-result');
        if(item.startsWith('[')||item.startsWith('.')||item.startsWith('#'))return false;
        return item.toUpperCase()===tag;
      });},
      closest(selector){for(let current=this;current;current=current.parent){if(current.matches(selector))return current;}return null;},
      getClientRects(){return [1];},getAttribute(){return null;},querySelector(){return null;},querySelectorAll(){return [];},
      children:[],textContent:'',parentElement:parent
    };
    nodes.push(node);return node;
  }
  const para=element('p','P',body),prose=element('prose','A',para,{href:true});
  const result=element('result','A',body,{href:true});
  const nav=element('nav','NAV',body),navLink=element('navLink','A',nav,{href:true});
  const form=element('searchForm','FORM',body,{role:'search'}),formButton=element('searchButton','BUTTON',form);
  const ordinaryForm=element('ordinaryForm','FORM',body),ordinaryButton=element('ordinaryButton','BUTTON',ordinaryForm);
  const resultGroup=element('searchResults','DIV',body,{classes:['search-results']}),resultParagraph=element('resultParagraph','P',resultGroup),resultInProse=element('resultProse','A',resultParagraph,{href:true});
  const button=element('contentButton','BUTTON',body);
  let index=0;
  const context={window:{},location:{protocol:'https:'},NodeFilter:{SHOW_ELEMENT:1},document:{body,documentElement:{hasAttribute:()=>false,setAttribute(){},},
    createTreeWalker(){index=0;return {get currentNode(){return nodes[index];},nextNode(){return nodes[++index]||null;}};}},
    getComputedStyle:()=>({color:'rgb(20,20,20)',backgroundImage:'none'})};
  vm.runInNewContext(await file('extension/colour-content.js'),context);
  context.window.__webbyColourAdaptation.apply({
    context:{preference:{enabled:true,userConfirmed:true},palette:{ink:'#17283b',surface:'#ffffff',action:'#174f87',accent:'#875000',notice:'#fff3d6',series:['#174f87','#875000','#56505e']}},
    settings:{enabled:true,darkMode:false},setStyle:(el,property,value)=>styles.push([el.id,property,value]),
    readColor:()=>({r:20,g:20,b:20,a:1}),backgroundFor:()=>({r:255,g:255,b:255,a:1}),contrastRatio:()=>12,chooseForeground:()=> '#000000'
  });
  const has=(id,property)=>styles.some(s=>s[0]===id&&s[1]===property);
  assert.equal(has('prose','text-decoration-line'),true);
  for(const id of ['result','navLink','resultProse'])assert.equal(has(id,'text-decoration-line'),false,id);
  assert.equal(has('searchButton','background-color'),false);
  assert.equal(has('contentButton','background-color'),true);
  assert.equal(has('ordinaryButton','background-color'),true);
});

test('reader workspace retains session-only drafts and summaries with a clear action',async()=>{
  const popup=await file('extension/popup.html');
  const workspace=await file('extension/reading-workspace.html');
  const reader=await file('extension/reading-ui.js');
  const background=await file('extension/background.js');
  for(const id of ['readingText','readingSummary','readingConsent','summarize','readText','readSummary','loadReading','stopReading','clearReading']){
    assert.match(popup,new RegExp(`id="${id}"`),`popup ${id}`);
    assert.match(workspace,new RegExp(`id="${id}"`),`workspace ${id}`);
  }
  assert.match(reader,/chrome\.storage\.session\.set/);
  assert.match(reader,/chrome\.storage\.session\.remove/);
  assert.match(reader,/chrome\.tabs\.create\(\{url\}\)/);
  assert.match(reader,/requestedAction/);
  assert.match(background,/chrome\.tabs\.onRemoved\.addListener/);
  assert.match(background,/chrome\.tabs\.onUpdated\.addListener/);
});
