'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controller/subscription.controller');
const { requireAuth } = require('../../../shared/middleware/auth.middleware');

/* ── PUBLIC ── */
router.post('/register',        controller.register);
router.post('/login',           controller.login);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password',  controller.resetPassword);
router.get('/plans',            controller.getPlans);

/* ── PROTECTED ── */
router.get('/me',               requireAuth, controller.getMe);
router.put('/me',               requireAuth, controller.updateMe);
router.put('/change-password',  requireAuth, controller.changePassword);
router.get('/usage',            requireAuth, controller.getUsage);
router.post('/upgrade',         requireAuth, controller.upgradePlan);

module.exports = router;