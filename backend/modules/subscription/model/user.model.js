'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    /* ── Identity ── */
    name: {
      type:     String,
      trim:     true,
      default:  '',
    },

    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },

    password: {
      type:     String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select:   false,   // never returned in queries by default
    },

    /* ── Subscription ── */
    plan: {
      type:    String,
      enum:    ['free', 'pro', 'premium'],
      default: 'free',
    },

    /* ── Usage Tracking ── */
    auditCountThisMonth: {
      type:    Number,
      default: 0,
      min:     0,
    },

    lastAuditResetDate: {
      type:    Date,
      default: () => new Date(),
    },

    /* ── Payment / Billing ── */
    stripeCustomerId: {
      type:    String,
      default: null,
    },

    subscriptionStartDate: {
      type:    Date,
      default: null,
    },

    subscriptionEndDate: {
      type:    Date,
      default: null,
    },

    /* ── Auth ── */
    isEmailVerified: {
      type:    Boolean,
      default: false,
    },

    passwordResetToken:   { type: String,  default: null },
    passwordResetExpires: { type: Date,    default: null },

    /* ── Status ── */
    isActive: {
      type:    Boolean,
      default: true,
    },

    role: {
      type:    String,
      enum:    ['user', 'admin'],
      default: 'user',
    },
  },
  {
    timestamps: true,   // createdAt, updatedAt
    versionKey: false,
  }
);

/* ── Pre-save: hash password ── */
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

/* ── Instance method: compare password ── */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/* ── Instance method: check if monthly reset is needed ── */
UserSchema.methods.needsMonthlyReset = function () {
  const now        = new Date();
  const lastReset  = new Date(this.lastAuditResetDate);
  return (
    now.getFullYear() > lastReset.getFullYear() ||
    now.getMonth()    > lastReset.getMonth()
  );
};

/* ── Instance method: perform monthly reset (call save() after) ── */
UserSchema.methods.resetMonthlyUsage = function () {
  this.auditCountThisMonth = 0;
  this.lastAuditResetDate  = new Date();
};

/* ── Static: find by email (includes password) ── */
UserSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email }).select('+password');
};

/* ── Index ── */
UserSchema.index({ email: 1 });

const User = mongoose.model('User', UserSchema);

module.exports = User;