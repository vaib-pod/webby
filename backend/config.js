import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';

// Read only the backend's local file. Shell variables take precedence.
export function loadConfig(env = process.env, file = new URL('./.env', import.meta.url)) {
  let local = {};
  try {local = parseEnv(readFileSync(file, 'utf8'));}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
  return {...local, ...env};
}
