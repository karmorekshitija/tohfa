const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'tohfa_super_secret_key_987654321';
const BCRYPT_SALT_ROUNDS = 12;

// Custom Rate Limiter Middleware
const rateLimiters = {};
function rateLimit(limit, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    
    if (!rateLimiters[ip]) {
      rateLimiters[ip] = {};
    }
    
    const clientLimits = rateLimiters[ip];
    const pathKey = req.path;
    
    if (!clientLimits[pathKey] || now - clientLimits[pathKey].startTime > windowMs) {
      clientLimits[pathKey] = {
        count: 1,
        startTime: now
      };
      return next();
    }
    
    clientLimits[pathKey].count++;
    if (clientLimits[pathKey].count > limit) {
      return res.status(429).json({
        error: true,
        message: "Too many requests, please try again later.",
        code: "RATE_LIMIT_EXCEEDED"
      });
    }
    next();
  };
}

// Helpers
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function generateTokens(user) {
  const accessToken = jwt.sign(
    { user_id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const plainRefreshToken = crypto.randomBytes(64).toString('hex');
  const hashedRefreshToken = crypto.createHash('sha256').update(plainRefreshToken).digest('hex');
  
  // 30 days expiry
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  
  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .run(user.id, hashedRefreshToken, expiresAt);
    
  return {
    accessToken,
    refreshToken: plainRefreshToken
  };
}

// TASK 03: POST /api/auth/register/buyer
app.post('/api/auth/register/buyer', rateLimit(10), async (req, res) => {
  const { full_name, email, password } = req.body;
  
  // 1. Validation
  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2 ||
      !email || typeof email !== 'string' || !validateEmail(email) ||
      !password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      error: true,
      message: "Missing or invalid fields",
      code: "VALIDATION_ERROR"
    });
  }
  
  try {
    // 2. Check if email exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({
        error: true,
        message: "Email already registered",
        code: "EMAIL_EXISTS"
      });
    }
    
    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    
    // 4. Insert user
    const info = db.prepare(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
    ).run(email, passwordHash, full_name, 'buyer');
    
    const userId = info.lastInsertRowid;
    const user = {
      id: userId,
      email,
      full_name,
      role: 'buyer',
      avatar_url: null
    };
    
    // 5. Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);
    
    // 6. Return response
    return res.status(201).json({
      success: true,
      data: {
        user,
        access_token: accessToken,
        refresh_token: refreshToken
      }
    });
  } catch (err) {
    console.error('Error in buyer registration:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 04: POST /api/auth/register/seller
app.post('/api/auth/register/seller', rateLimit(10), async (req, res) => {
  const { full_name, email, password, shop_name, shop_bio, ships_in_days, instagram_handle } = req.body;
  
  // 1. Validation
  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2 ||
      !email || typeof email !== 'string' || !validateEmail(email) ||
      !password || typeof password !== 'string' || password.length < 8 ||
      !shop_name || typeof shop_name !== 'string' || shop_name.trim().length < 2) {
    return res.status(400).json({
      error: true,
      message: "Missing or invalid fields",
      code: "VALIDATION_ERROR"
    });
  }
  
  let finalShipsInDays = ships_in_days;
  if (finalShipsInDays === undefined || finalShipsInDays === null) {
    finalShipsInDays = 7;
  } else if (!Number.isInteger(finalShipsInDays) || finalShipsInDays < 1) {
    return res.status(400).json({
      error: true,
      message: "ships_in_days must be an integer >= 1",
      code: "VALIDATION_ERROR"
    });
  }
  
  if (shop_bio && (typeof shop_bio !== 'string' || shop_bio.length > 500)) {
    return res.status(400).json({
      error: true,
      message: "shop_bio must be a string up to 500 characters",
      code: "VALIDATION_ERROR"
    });
  }
  
  let insta = instagram_handle;
  if (typeof insta === 'string') {
    insta = insta.trim();
    if (insta.startsWith('@')) {
      insta = insta.substring(1);
    }
  } else {
    insta = null;
  }
  
  try {
    // 2. Check if email exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({
        error: true,
        message: "Email already registered",
        code: "EMAIL_EXISTS"
      });
    }
    
    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    
    // 4. DB Transactions for users and seller_profiles
    const insertTransaction = db.transaction(() => {
      // Insert user
      const userInfo = db.prepare(
        'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
      ).run(email, passwordHash, full_name, 'seller');
      
      const userId = userInfo.lastInsertRowid;
      
      // Insert seller profile
      db.prepare(
        'INSERT INTO seller_profiles (user_id, shop_name, shop_bio, ships_in_days, instagram_handle) VALUES (?, ?, ?, ?, ?)'
      ).run(userId, shop_name, shop_bio || null, finalShipsInDays, insta);
      
      return userId;
    });
    
    const userId = insertTransaction();
    
    const user = {
      id: userId,
      email,
      full_name,
      role: 'seller',
      avatar_url: null
    };
    
    const seller_profile = {
      shop_name,
      is_approved: false
    };
    
    // 5. Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);
    
    // 6. Return response
    return res.status(201).json({
      success: true,
      data: {
        user,
        seller_profile,
        access_token: accessToken,
        refresh_token: refreshToken
      }
    });
  } catch (err) {
    console.error('Error in seller registration:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };
