'use strict';
/**
 * Admin Model
 * Roles: admin | super_admin
 * Super admin can manage admins; admin manages platform data.
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const loginHistorySchema = new mongoose.Schema({
  ip:        { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now },
  success:   { type: Boolean, default: true },
}, { _id: false });

const adminSchema = new mongoose.Schema(
  {
    username:  { type: String, required: true, unique: true, trim: true, minlength: 3 },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, required: true, select: false },
    role:      { type: String, enum: ['admin', 'super_admin'], default: 'admin' },
    fullName:  { type: String, trim: true },
    avatar:    { type: String },
    isActive:  { type: Boolean, default: true },

    /* granular permissions (super_admin ignores these — has all) */
    permissions: {
      viewUsers:    { type: Boolean, default: true  },
      editUsers:    { type: Boolean, default: false },
      deleteUsers:  { type: Boolean, default: false },
      viewAudits:   { type: Boolean, default: true  },
      deleteAudits: { type: Boolean, default: false },
      viewRevenue:  { type: Boolean, default: false },
    },

    lastLogin:    { type: Date },
    loginHistory: { type: [loginHistorySchema], default: [] },

    /* who created this admin */
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

/* ── Hooks ── */
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/* ── Methods ── */
adminSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

adminSchema.methods.recordLogin = async function (ip, userAgent, success = true) {
  this.loginHistory.unshift({ ip, userAgent, success, timestamp: new Date() });
  if (this.loginHistory.length > 20) this.loginHistory = this.loginHistory.slice(0, 20);
  if (success) this.lastLogin = new Date();
  await this.save();
};

/* ── Statics ── */
adminSchema.statics.createSuperAdmin = async function ({ username, email, password, fullName }) {
  const exists = await this.findOne({ role: 'super_admin' });
  if (exists) throw new Error('Super admin already exists');
  return this.create({ username, email, password, fullName, role: 'super_admin' });
};

/* hide password in JSON responses */
adminSchema.set('toJSON', {
  transform (doc, ret) {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('Admin', adminSchema);