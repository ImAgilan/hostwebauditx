'use strict';
const router = require('express').Router();
const ctrl = require('../controller/chatbot.controller');

// Optional auth middleware — chatbot works for guests too
const optionalAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const jwt = require('jsonwebtoken');
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    }
  } catch {}
  next();
};

router.post('/chat',          optionalAuth, ctrl.chat);
router.get('/history/:sessionId', ctrl.getHistory);
router.delete('/session/:sessionId', ctrl.clearSession);
router.post('/suggestions',   ctrl.getSuggestions);

module.exports = router;