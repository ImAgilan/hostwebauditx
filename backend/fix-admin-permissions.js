/**
 * fix-admin-permissions.js
 *
 * Run this ONCE to update any existing admin accounts in MongoDB
 * that were created with the old defaults (viewRevenue: false, etc.)
 *
 * Usage:
 *   node fix-admin-permissions.js
 *
 * Run from your backend root directory.
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main () {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'WebAuditX' });
  console.log('[DB] Connected');

  const result = await mongoose.connection.db
    .collection('admins')
    .updateMany(
      { role: 'admin' },
      {
        $set: {
          'permissions.viewUsers':    true,
          'permissions.editUsers':    true,
          'permissions.deleteUsers':  true,
          'permissions.viewAudits':   true,
          'permissions.deleteAudits': true,
          'permissions.viewRevenue':  true,
        },
      }
    );

  console.log(`[Fix] Updated ${result.modifiedCount} admin account(s).`);
  await mongoose.disconnect();
  console.log('[Done] All existing admins now have full permissions.');
}

main().catch(console.error);