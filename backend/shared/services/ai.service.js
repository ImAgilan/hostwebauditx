'use strict';
/**
 * Shared AI Service — Multi-provider fallback chain
 * Priority: Groq → Gemini → Claude (Anthropic) → DeepSeek
 *
 * All calls use axios directly so no extra SDK dependencies are needed.
 * Each provider is skipped if its API key is not set in .env.
 */

const axios = require('axios');

/* ─────────────────────────────────────────────────
   Provider definitions
───────────────────────────────────────────────── */
const PROVIDERS = [
  {
    name: 'groq',
    apiKey: () => process.env.GROQ_API_KEY,
    format: 'openai',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
  },
  {
    name: 'gemini',
    apiKey: () => process.env.GEMINI_API_KEY,
    format: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    model: 'gemini-1.5-flash',
  },
  {
    name: 'claude',
    apiKey: () => process.env.ANTHROPIC_API_KEY,
    format: 'anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-haiku-20240307',
  },
  {
    name: 'deepseek',
    apiKey: () => process.env.DEEPSEEK_API_KEY,
    format: 'openai',
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
  },
];

/* ─────────────────────────────────────────────────
   Per-format callers
───────────────────────────────────────────────── */
async function callOpenAI(provider, systemPrompt, userPrompt) {
  const res = await axios.post(
    provider.url,
    {
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 2500,
    },
    {
      headers: {
        Authorization: `Bearer ${provider.apiKey()}`,
        'Content-Type': 'application/json',
      },
      timeout: 45_000,
    }
  );
  return res.data.choices[0].message.content;
}

async function callGemini(provider, systemPrompt, userPrompt) {
  const url = `${provider.url}?key=${provider.apiKey()}`;
  const res = await axios.post(
    url,
    {
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2500 },
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 45_000 }
  );
  return res.data.candidates[0].content.parts[0].text;
}

async function callAnthropic(provider, systemPrompt, userPrompt) {
  const res = await axios.post(
    provider.url,
    {
      model: provider.model,
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    },
    {
      headers: {
        'x-api-key': provider.apiKey(),
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 45_000,
    }
  );
  return res.data.content[0].text;
}

/* ─────────────────────────────────────────────────
   Public API
───────────────────────────────────────────────── */

/**
 * generateAIResponse
 * Tries each provider in order, returns on first success.
 *
 * @param {string} userPrompt
 * @param {string} [systemPrompt]
 * @returns {Promise<{ text: string, provider: string }>}
 */
async function generateAIResponse(
  userPrompt,
  systemPrompt = 'You are an expert web analyst. Always respond with valid JSON only.'
) {
  const errors = [];

  for (const provider of PROVIDERS) {
    const key = provider.apiKey();
    if (!key) {
      errors.push(`${provider.name}: no API key`);
      continue;
    }

    try {
      let text;
      if (provider.format === 'openai') text = await callOpenAI(provider, systemPrompt, userPrompt);
      else if (provider.format === 'gemini') text = await callGemini(provider, systemPrompt, userPrompt);
      else if (provider.format === 'anthropic') text = await callAnthropic(provider, systemPrompt, userPrompt);

      console.log(`[AI] Response from ${provider.name}`);
      return { text, provider: provider.name };
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      console.warn(`[AI] ${provider.name} failed: ${msg}`);
      errors.push(`${provider.name}: ${msg}`);
    }
  }

  throw new Error(`All AI providers failed.\n${errors.join('\n')}`);
}

/**
 * safeParseJSON
 * Strips markdown fences then parses JSON.
 * Returns parsed object or throws.
 */
function safeParseJSON(raw) {
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
}

module.exports = { generateAIResponse, safeParseJSON };


