export const MAX_READING_TEXT = 12000;
export const MAX_SPEECH_TEXT = 1500;

export function validateTextRequest(input, max = MAX_READING_TEXT) {
  if (!input || input.consent !== true) throw Object.assign(new Error('Explicit text-sharing consent is required.'), {status:403});
  if (typeof input.text !== 'string' || !input.text.trim()) throw new Error('Text must not be empty.');
  if (input.text.length > max) throw new Error(`Text must contain at most ${max} characters.`);
  return {text:input.text.trim(), consent:true};
}

// Each request stays small; chunks preserve all text and favor sentence/word boundaries.
export function speechChunks(text, max = MAX_SPEECH_TEXT) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > max) {
    const window = remaining.slice(0, max + 1);
    let split = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
    split = split >= max / 2 ? split + 1 : window.lastIndexOf(' ');
    if (split < max / 2) split = max;
    // Do not separate a UTF-16 surrogate pair.
    if (/[\uD800-\uDBFF]/.test(remaining[split - 1])) split--;
    chunks.push(remaining.slice(0, split).trim());
    remaining = remaining.slice(split).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
