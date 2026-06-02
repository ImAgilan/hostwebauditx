'use strict';
const Groq = require('groq-sdk');
const Chatbot = require('../model/chatbot.model');
const { v4: uuidv4 } = require('uuid');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are WebAuditX AI Assistant — an expert web auditing analyst embedded inside the WebAuditX platform.

You help users understand their website audit results across 9 modules:
1. UI/UX Design Analysis
2. Mobile-Friendliness
3. Accessibility & WCAG
4. SEO & Content Analysis
5. Performance Testing
6. Security & HTTPS
7. Content Quality
8. Structure & Navigation
9. Technical Insights

Your capabilities:
- Explain audit scores and what they mean
- Diagnose issues found in the audit
- Provide step-by-step fix instructions
- Recommend tools and best practices
- Generate code snippets (HTML, CSS, JS, PHP, etc.) when asked
- Compare results and suggest priorities
- Explain technical concepts in plain English

Tone: Professional, helpful, concise. Use bullet points and code blocks when relevant.
Always relate your answers to web auditing, performance, SEO, accessibility, or security.
If the user provides audit context, refer to it specifically.`;

async function getOrCreateSession(sessionId, userId, auditId, auditContext) {
  let session = await Chatbot.findOne({ sessionId });
  if (!session) {
    session = await Chatbot.create({
      sessionId,
      userId: userId || null,
      auditId: auditId || null,
      auditContext: auditContext || null,
      messages: [],
    });
  } else if (auditContext && !session.auditContext) {
    session.auditContext = auditContext;
    await session.save();
  }
  return session;
}

async function sendMessage({ sessionId, userId, message, auditId, auditContext }) {
  const sid = sessionId || uuidv4();
  const session = await getOrCreateSession(sid, userId, auditId, auditContext);

  // Build messages array for Groq
  const systemContent = auditContext
    ? `${SYSTEM_PROMPT}\n\n--- CURRENT AUDIT CONTEXT ---\n${JSON.stringify(auditContext, null, 2)}\n--- END CONTEXT ---`
    : SYSTEM_PROMPT;

  const history = session.messages.slice(-20).map(m => ({
    role: m.role,
    content: m.content,
  }));

  history.push({ role: 'user', content: message });

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'system', content: systemContent }, ...history],
    max_tokens: 1024,
    temperature: 0.7,
  });

  const reply = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

  // Save both messages
  session.messages.push({ role: 'user', content: message });
  session.messages.push({ role: 'assistant', content: reply });
  session.updatedAt = new Date();
  await session.save();

  return { sessionId: sid, reply, messageCount: session.messages.length };
}

async function getHistory(sessionId) {
  const session = await Chatbot.findOne({ sessionId });
  if (!session) return null;
  return { sessionId, messages: session.messages, auditId: session.auditId };
}

async function clearSession(sessionId) {
  const session = await Chatbot.findOne({ sessionId });
  if (!session) return false;
  session.messages = [];
  session.updatedAt = new Date();
  await session.save();
  return true;
}

async function getSuggestedQuestions(auditContext) {
  if (!auditContext) {
    return [
      'What is Largest Contentful Paint (LCP)?',
      'How do I improve my SEO score?',
      'What are the most important security headers?',
      'How do I fix missing alt text?',
      'What is a good Core Web Vitals score?',
    ];
  }

  const prompt = `Based on this audit context, generate exactly 5 short, specific follow-up questions a user might ask. Return only a JSON array of 5 strings. No preamble.
Context: ${JSON.stringify(auditContext)}`;

  try {
    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.5,
    });
    const text = res.choices[0]?.message?.content || '[]';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return [
      'What are my most critical issues?',
      'How do I fix the top performance issue?',
      'What is causing my low SEO score?',
      'How can I improve accessibility?',
      'What security issues should I fix first?',
    ];
  }
}

module.exports = { sendMessage, getHistory, clearSession, getSuggestedQuestions };