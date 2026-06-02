'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controller/auditHistory.controller');
const { requireAuth } = require('../../../shared/middleware/auth.middleware');

/* All routes require auth */
router.use(requireAuth);

/* GET  /api/audit-history         — paginated list */
router.get('/',       controller.getHistory);

/* GET  /api/audit-history/stats   — aggregate stats */
router.get('/stats',  controller.getStats);

/* DELETE /api/audit-history       — clear all */
router.delete('/',    controller.clearAll);

/* DELETE /api/audit-history/:id   — delete one */
router.delete('/:id', controller.deleteEntry);

module.exports = router;