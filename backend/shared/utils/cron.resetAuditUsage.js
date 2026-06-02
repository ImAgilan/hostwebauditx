'use strict';

/**
 * cron.resetAuditUsage.js
 *
 * Optional: scheduled monthly reset instead of lazy reset.
 * Runs on the 1st of every month at 00:00.
 *
 * Install: npm install node-cron
 * Then call setupCronJobs() in server.js
 */

const cron = require('node-cron');
const User = require('../../modules/subscription/model/user.model');

function setupCronJobs() {
  // Runs at 00:00 on the 1st day of every month
  cron.schedule('0 0 1 * *', async () => {
    console.log('[CRON] Running monthly audit usage reset...');
    try {
      const result = await User.updateMany(
        {},
        {
          $set: {
            auditCountThisMonth: 0,
            lastAuditResetDate:  new Date(),
          },
        }
      );
      console.log(`[CRON] Reset complete. Users updated: ${result.modifiedCount}`);
    } catch (err) {
      console.error('[CRON] Monthly reset failed:', err.message);
    }
  });

  console.log('[CRON] Monthly audit reset job scheduled.');
}

module.exports = { setupCronJobs };