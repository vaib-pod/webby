const PROVIDERS = {
  groq: {key:'GROQ_API_KEY', modelKey:'GROQ_MODEL', model:'llama-3.3-70b-versatile', url:'https://api.groq.com/openai/v1/chat/completions'},
  xai: {key:'XAI_API_KEY', modelKey:'XAI_MODEL', model:'grok-4.3', url:'https://api.x.ai/v1/chat/completions'},
  openai: {key:'OPENAI_API_KEY', modelKey:'OPENAI_MODEL', model:'gpt-4o-mini', url:'https://api.openai.com/v1/chat/completions'}
};

export function apiError(message, status = 502) {
  return Object.assign(new Error(message), {status});
}

export function chatConfig(env) {
  const name = env.SUMMARY_PROVIDER || (env.GROQ_API_KEY ? 'groq' : env.XAI_API_KEY ? 'xai' : 'openai');
  const provider = PROVIDERS[name];
  if (!provider) throw apiError('SUMMARY_PROVIDER must be groq, xai, or openai.', 503);
  const key = env[provider.key]?.trim();
  if (name === 'groq' && key?.startsWith('xai-')) {
    throw apiError('This is an xAI/Grok key, not a Groq key. Use XAI_API_KEY and SUMMARY_PROVIDER=xai.', 503);
  }
  return {...provider, name, key, model:env[provider.modelKey] || provider.model};
}

export function providerFailure(name, status, details = null) {
  // Classify known account errors without exposing provider messages, team IDs,
  // request contents or credentials in the extension.
  const message = [details?.error, details?.error?.message, details?.message]
    .filter(value => typeof value === 'string').join(' ');
  if (name === 'xai' && [402,403,429].includes(status) &&
      /(?:no|insufficient|not enough|out of|used all|exhausted)[^.!?]{0,80}credits|(?:doesn't|does not) have (?:any )?credits|credits[^.!?]{0,80}(?:exhausted|depleted)|(?:reached|exceeded)[^.!?]{0,80}(?:spending|spend) limit/i.test(message)) {
    return apiError('xAI cannot summarize because the API team has no available credits or has reached its spending limit. Check billing and the spending limit in the xAI Console for the team that owns your API key. Read aloud uses a separate provider.', 502);
  }
  const hint = [401,403].includes(status) ? 'Check the API key, its permissions, and your account credits.'
    : status === 402 ? 'Check your provider credits.'
    : status === 429 ? 'Rate limit or quota reached; check usage and try again later.'
    : status === 404 ? 'Check the configured model.' : 'Try again later or check the provider configuration.';
  return apiError(`${name} returned HTTP ${status}. ${hint}`, status === 429 ? 429 : 502);
}

export async function chatCompletion(messages, env, {json = false, timeout = 25000, fetchImpl = fetch} = {}) {
  const provider = chatConfig(env);
  if (!provider.key) throw apiError(`Configure ${provider.key} in backend/.env.`, 503);
  try {
    const response = await fetchImpl(provider.url, {
      method:'POST', redirect:'error', signal:AbortSignal.timeout(timeout),
      headers:{'Content-Type':'application/json', Authorization:`Bearer ${provider.key}`},
      body:JSON.stringify({model:provider.model, temperature:0.1, max_tokens:700,
        ...(provider.name === 'xai' ? {reasoning_effort:'none'} : {}),
        ...(json ? {response_format:{type:'json_object'}} : {}), messages})
    });
    if (!response.ok) {
      const details = await response.json().catch(() => null);
      throw providerFailure(provider.name, response.status, details);
    }
    const payload = await response.json();
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw apiError('The summary provider returned no text.');
    return {text:text.trim(), provider:provider.name};
  } catch (error) {
    if (error.status) throw error;
    throw apiError(error.name === 'TimeoutError' ? 'The summary provider timed out. Try again.' : 'Cannot reach the summary provider or read its response.');
  }
}
