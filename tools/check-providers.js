// Explicit live smoke test; sends only this fixed sample, never page content.
import {loadConfig} from '../backend/config.js';
import {summarize, synthesize} from '../backend/reading.js';

const env = loadConfig();
const input = {text:'WEBBY helps people read webpages with comfortable text and clear navigation.',consent:true};
for (const [name,run] of [['Summary',summarize],['Gnani speech',synthesize]]) {
  try {
    const result = await run(input,env);
    console.log(`${name}: OK (${Buffer.isBuffer(result) ? `${result.length} WAV bytes` : result.provider})`);
  } catch (error) {
    console.error(`${name}: ${error.message}`);
    process.exitCode = 1;
  }
}
