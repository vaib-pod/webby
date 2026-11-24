import {readdir, readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

async function files(dir){
  const output=[];
  for(const item of await readdir(dir,{withFileTypes:true})){
    if(item.isDirectory())output.push(...await files(path.join(dir,item.name)));
    else if(item.name.endsWith('.js'))output.push(path.join(dir,item.name));
  }
  return output;
}
let failures=0;
for(const filename of await files('.')){
  const result=spawnSync(process.execPath,['--check',filename],{encoding:'utf8'});
  if(result.status!==0){failures++;console.error(filename,result.stderr);}
}
const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));
if(manifest.manifest_version!==3 || !manifest.background?.service_worker || !manifest.action?.default_popup){
  console.error('Invalid manifest properties');failures++;
}
if(failures){console.error(`Validation failed: ${failures} issue(s)`);process.exitCode=1;}
else console.log('WEBBY validation OK: all JavaScript syntax valid; Manifest V3 fields present.');
