import {
  fallbackRecommendations,validateAnalyzeRequest,validateAnalyzeResponse
} from '../extension/shared/contracts.js';

const SYSTEM_PROMPT = `You are WEBBY's conservative accessibility recommendation engine. You receive a sanitized STRUCTURAL summary with no user text, form data or raw HTML. Recommend only safe, reversible accessibility changes that address actual issues and respect the user profile. You must NEVER infer disabilities. Do not invent page details. Return JSON object with keys "actions" (array of up to 6 allowed actions) and "reasons" (array of up to 5 concise explanations). Action types: SET_TEXT_SCALE (factor from 1 to 1.5), SET_LINE_HEIGHT (ratio from 1.2 to 2), BOOST_CONTRAST, REDUCE_MOTION, ENHANCE_FOCUS, HIGHLIGHT_MAIN (requires targetId of an element with role main). An optional targetId is supported only if it matches a supplied opaque element id. Do not return CSS/HTML/JS or arbitrary selector strings. Avoid changes that could compromise functional controls. If uncertain, return fewer actions.`;

export async function recommend(request, config = process.env) {
  const safeRequest = validateAnalyzeRequest(request);
  if (!config.OPENAI_API_KEY) {
    return {...fallbackRecommendations(safeRequest), note:'AI unavailable: OPENAI_API_KEY is not configured.'};
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',signal:controller.signal,
        headers:{'content-type':'application/json',authorization:`Bearer ${config.OPENAI_API_KEY}`},
        body: JSON.stringify({
          model:config.OPENAI_MODEL || 'gpt-4o-mini',
          temperature:0.1,
          response_format:{type:'json_object'},
          messages:[
            {role:'system',content:SYSTEM_PROMPT},
            {role:'user',content:JSON.stringify(safeRequest)}
          ]
        })
      });
    } finally {clearTimeout(timer);}
    if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
    const payload = await response.json();
    const generated = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
    const clean = validateAnalyzeResponse({...generated,source:'ai'},safeRequest.page);
    if (clean.actions.length === 0) {
      return {...fallbackRecommendations(safeRequest),note:'AI returned no valid actions; local fallback used.'};
    }
    return clean;
  } catch (error) {
    console.warn('[WEBBY] AI fallback:', error instanceof Error ? error.message : 'Unknown error');
    return {...fallbackRecommendations(safeRequest),note:'AI provider unavailable; local fallback used.'};
  }
}
