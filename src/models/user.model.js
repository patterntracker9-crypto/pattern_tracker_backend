// models/user.model.js - WITHOUT PRE-SAVE HOOK
import mongoose, { Schema } from 'mongoose';
import jwt from 'jsonwebtoken';

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    employee_id: {
      type: Number,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    refreshToken: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// 🔹 REMOVED pre-save hook completely
// 🔹 Password Compare Method (will import bcrypt dynamically)
userSchema.methods.comparePassword = async function (plainPassword) {
  const bcrypt = await import('bcrypt');
  return await bcrypt.compare(plainPassword, this.password);
};

// 🔹 Access Token Generate
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      employee_id: this.employee_id,
      username: this.username,
    },
    process.env.ACCESS_TOKEN_SECRET || 'access_secret_fallback',
    { expiresIn: process.env.ACCESS_TOKEN_SECRET_EXPIRY || '15m' }
  );
};

// 🔹 Refresh Token Generate
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET || 'refresh_secret_fallback',
    { expiresIn: process.env.REFRESH_TOKEN_SECRET_EXPIRY || '7d' }
  );
};

// Remove sensitive information from JSON output
userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.__v;
    delete ret.refreshToken;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);
export { User };
