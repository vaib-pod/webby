import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {loadConfig} from './config.js';
import {chatConfig} from './providers.js';
import {summarize, synthesize} from './reading.js';

const MAX_BODY = 80 * 1024;

function corsHeaders(origin) {
  // Only Chrome extensions can make cross-origin browser requests to this local demo API.
  // Ordinary websites are not granted CORS permission.
  if (typeof origin === 'string' && /^chrome-extension:\/\/[a-p]{32}$/.test(origin)) {
    return {'Access-Control-Allow-Origin':origin,'Vary':'Origin',
      'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type'};
  }
  return {};
}
function json(res, status, body, headers={}) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers});
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const error = new Error('Request too large'); error.status = 413; throw error;
    }
    chunks.push(chunk);
  }
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch {const error = new Error('Invalid JSON'); error.status = 400; throw error;}
}

export function makeServer(env=process.env, fetchImpl=fetch) {
  return http.createServer(async (req,res) => {
    const headers = corsHeaders(req.headers.origin);
    if (req.method === 'OPTIONS') {
      if (Object.keys(headers).length === 0) return json(res,403,{error:'Origin not allowed'});
      res.writeHead(204,headers); res.end(); return;
    }
    if (req.url === '/api/health' && req.method === 'GET') {
      let provider;
      try {provider = chatConfig(env);} catch {provider = null;}
      return json(res,200,{status:'ok',
        summaryProvider:provider?.name ?? null, summaryConfigured:Boolean(provider?.key),
        speechConfigured:Boolean(env.GNANI_API_KEY), version:1}, headers);
    }
    if (['/api/summarize','/api/speech'].includes(req.url) && req.method === 'POST') {
      if (req.headers.origin && Object.keys(headers).length === 0) {
        return json(res,403,{error:'Origin not allowed'});
      }
      if (!(req.headers['content-type'] ?? '').startsWith('application/json')) {
        return json(res,415,{error:'Content-Type must be application/json'},headers);
      }
      try {
        const body = await readJson(req);
        if (req.url === '/api/summarize') return json(res,200,await summarize(body,env,fetchImpl),headers);
        if (req.url === '/api/speech') {
          const audio = await synthesize(body,env,fetchImpl);
          res.writeHead(200,{'Content-Type':'audio/wav', 'Content-Length':audio.length,
            'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers});
          res.end(audio); return;
        }
      } catch(error) {
        return json(res,error.status ?? 400,{error:error.message || 'Invalid request'},headers);
      }
    }
    return json(res,404,{error:'Not found'},headers);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // Binding to loopback prevents unintended remote connections to a development server.
  const config = loadConfig();
  const server = makeServer(config);
  const port = Number(config.PORT || 3001);
  server.listen(port,'127.0.0.1', () =>
    console.log(`[WEBBY] backend on http://127.0.0.1:${port}; configure providers in backend/.env`));
}
