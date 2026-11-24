import {spawn} from 'node:child_process';

// DevTools pipe transport keeps real animation frames running. --dump-dom with
// virtual time can finish before requestAnimationFrame callbacks ever execute.
export async function withChromium(browser, profile, run, extraArgs=[]) {
  const child = spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
    '--disable-background-networking','--disable-renderer-backgrounding',
    `--user-data-dir=${profile}`,'--remote-debugging-pipe',...extraArgs,'about:blank'],
  {windowsHide:true,stdio:['ignore','ignore','pipe','pipe','pipe']});
  let nextId=0, pendingText='', stderr='';
  const pending = new Map();
  const closed = new Promise(resolve=>child.once('exit',resolve));
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-1500);});
  const fail = error => {for(const item of pending.values()){clearTimeout(item.timer);item.reject(error);}pending.clear();};
  child.on('error',fail);
  child.on('exit',()=>fail(new Error(`Chrome exited before the check finished. ${stderr}`)));
  child.stdio[3].on('error',fail);
  child.stdio[4].on('data',chunk=>{
    pendingText += chunk.toString();
    let split;
    while((split=pendingText.indexOf('\0'))>=0){
      const raw=pendingText.slice(0,split);pendingText=pendingText.slice(split+1);
      if(!raw)continue;
      const message=JSON.parse(raw), item=pending.get(message.id);
      if(!item)continue;
      pending.delete(message.id);clearTimeout(item.timer);
      if(message.error)item.reject(new Error(message.error.message));else item.resolve(message.result);
    }
  });
  function call(method,params={},sessionId) {
    return new Promise((resolve,reject)=>{
      const id=++nextId;
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Chrome timed out: ${method}`));},10000);
      pending.set(id,{resolve,reject,timer});
      child.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');
    });
  }
  try {
    return await run(call);
  } finally {
    await call('Browser.close').catch(()=>{});
    const exited=await Promise.race([closed.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),2000))]);
    if(!exited)child.kill();
  }
}

export async function checkInChromium(browser, profile, url) {
  return withChromium(browser,profile,async call=>{
    const {targetId}=await call('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
    await call('Page.enable',{},sessionId);
    await call('Page.navigate',{url},sessionId);
    const deadline=Date.now()+20000;
    while(Date.now()<deadline){
      const result=await call('Runtime.evaluate',{expression:'document.getElementById("browser-results")?.textContent',returnByValue:true},sessionId);
      if(result.result?.value)return JSON.parse(result.result.value);
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error(`Browser did not produce results for ${url}.`);
  });
}
