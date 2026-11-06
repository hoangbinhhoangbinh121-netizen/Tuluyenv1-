'use strict';
/** Gemini (tuỳ chọn) — luôn có fallback, không bao giờ làm bot crash vì mạng. */
const MODEL = 'gemini-2.0-flash';
async function geminiGenerate(prompt, fallback, { timeout = 6, maxTokens = 120, temperature = 1.1 } = {}) {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) return fallback;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature, maxOutputTokens: maxTokens } }),
      signal: AbortSignal.timeout(timeout * 1000),
    });
    const data = await res.json();
    const text = String(data.candidates[0].content.parts[0].text || '').trim();
    return text || fallback;
  } catch (_) { return fallback; }
}
module.exports = { geminiGenerate };
