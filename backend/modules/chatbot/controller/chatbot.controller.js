'use strict';
const service = require('../service/chatbot.service');

async function chat(req, res) {
  try {
    const { sessionId, message, auditId, auditContext } = req.body;
    const userId = req.user?._id || null;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message is required' });

    const result = await service.sendMessage({ sessionId, userId, message, auditId, auditContext });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Chatbot] chat error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getHistory(req, res) {
  try {
    const { sessionId } = req.params;
    const data = await service.getHistory(sessionId);
    if (!data) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function clearSession(req, res) {
  try {
    const { sessionId } = req.params;
    const cleared = await service.clearSession(sessionId);
    res.json({ success: cleared });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getSuggestions(req, res) {
  try {
    const { auditContext } = req.body;
    const questions = await service.getSuggestedQuestions(auditContext || null);
    res.json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { chat, getHistory, clearSession, getSuggestions };