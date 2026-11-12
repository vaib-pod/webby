import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {validateAnalyzeRequest} from '../extension/shared/contracts.js';
import {recommend} from './ai.js';

const MAX_BODY = 24 * 1024;

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

export function makeServer(env=process.env) {
  return http.createServer(async (req,res) => {
    const headers = corsHeaders(req.headers.origin);
    if (req.method === 'OPTIONS') {
      if (Object.keys(headers).length === 0) return json(res,403,{error:'Origin not allowed'});
      res.writeHead(204,headers); res.end(); return;
    }
    if (req.url === '/api/health' && req.method === 'GET') {
      return json(res,200,{status:'ok', aiConfigured:Boolean(env.OPENAI_API_KEY),version:1}, headers);
    }
    if (req.url === '/api/analyze' && req.method === 'POST') {
      if (req.headers.origin && Object.keys(headers).length === 0) {
        return json(res,403,{error:'Origin not allowed'});
      }
      if (!(req.headers['content-type'] ?? '').startsWith('application/json')) {
        return json(res,415,{error:'Content-Type must be application/json'},headers);
      }
      try {
        const input = validateAnalyzeRequest(await readJson(req));
        const output = await recommend(input,env);
        return json(res,200,output,headers);
      } catch(error) {
        return json(res,error.status ?? 400,{error:error.message || 'Invalid request'},headers);
      }
    }
    return json(res,404,{error:'Not found'},headers);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // Binding to loopback prevents unintended remote connections to a development server.
  const server = makeServer();
  const port = Number(process.env.PORT || 3001);
  server.listen(port,'0.0.0.0', () =>
    console.log(`[WEBBY] backend on http://127.0.0.1:${port}; AI key ${process.env.OPENAI_API_KEY ? 'configured' : 'missing (offline fallback)'}`));
}
