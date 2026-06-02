/**
 * fix-subscription-tiers.js
 *
 * One-time script: renames old 4-tier values to new 3-tier values
 * to match your Home.jsx pricing page exactly.
 *
 * OLD tiers  →  NEW tiers
 * ─────────────────────────
 * free       →  free      (no change — still "Starter" plan)
 * starter    →  free      (was $9 tier, now merged into free)
 * pro        →  pro       (no change — still $29 "Professional")
 * ultra      →  premium   (was $89 "Ultra", now "Agency" = premium)
 *
 * Usage:
 *   node fix-subscription-tiers.js
 *
 * Run from your backend root. Delete after running.
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main () {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'WebAuditX' });
  console.log('[DB] Connected to WebAuditX');

  const db = mongoose.connection.db;
  const col = db.collection('appusers');

  // Rename 'starter' → 'free'
  const r1 = await col.updateMany(
    { subscription: 'starter' },
    { $set: { subscription: 'free' } }
  );
  console.log(`[Fix] starter → free: ${r1.modifiedCount} users updated`);

  // Rename 'ultra' → 'premium'
  const r2 = await col.updateMany(
    { subscription: 'ultra' },
    { $set: { subscription: 'premium' } }
  );
  console.log(`[Fix] ultra → premium: ${r2.modifiedCount} users updated`);

  // Verify final counts
  const counts = await col.aggregate([
    { $group: { _id: '$subscription', count: { $sum: 1 } } },
  ]).toArray();

  console.log('\n[Result] Subscription counts after fix:');
  counts.forEach(c => console.log(`  ${c._id}: ${c.count} users`));

  await mongoose.disconnect();
  console.log('\n[Done] Tiers now match your 3-plan homepage. Delete this script.');
}

main().catch(console.error);