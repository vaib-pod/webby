import test from 'node:test';
import assert from 'node:assert/strict';
import {makeServer} from '../backend/server.js';
import {DEFAULT_PROFILE} from '../extension/shared/contracts.js';

const request={version:1,profile:DEFAULT_PROFILE,page:{category:'article',prefersDarkTheme:false,
  elements:[{id:'e1',role:'main',tag:'MAIN'}],issues:[{type:'small-text',severity:'high'}]}};

test('HTTP backend health, validated analysis, and hostile request rejection',async()=>{
  const server=makeServer({});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();
  const base=`http://127.0.0.1:${address.port}`;
  try{
    let res=await fetch(`${base}/api/health`);
    assert.equal(res.status,200);
    assert.equal((await res.json()).aiConfigured,false);
    res=await fetch(`${base}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
    assert.equal(res.status,200);
    const result=await res.json();
    assert.equal(result.source,'fallback');
    assert.ok(result.actions.length>0);
    res=await fetch(`${base}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,page:{...request.page,issues:'not an array'}})});
    assert.equal(res.status,400);
    res=await fetch(`${base}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:JSON.stringify(request)});
    assert.equal(res.status,403);
    res=await fetch(`${base}/api/analyze`,{method:'OPTIONS',headers:{Origin:'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}});
    assert.equal(res.status,204);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
