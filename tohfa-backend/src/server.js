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

// TASK 05: POST /api/auth/login
app.post('/api/auth/login', rateLimit(20), async (req, res) => {
  const { email, password } = req.body;
  
  // 1. Validation
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({
      error: true,
      message: "Missing email or password",
      code: "VALIDATION_ERROR"
    });
  }
  
  try {
    // 2. Look up user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({
        error: true,
        message: "Hm, that credential set doesn't seem right.",
        code: "INVALID_CREDENTIALS"
      });
    }
    
    // 3. Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        error: true,
        message: "Hm, that credential set doesn't seem right.",
        code: "INVALID_CREDENTIALS"
      });
    }
    
    // 4. Check active/banned status
    if (user.is_banned === 1) {
      return res.status(403).json({
        error: true,
        message: "Account banned",
        code: "ACCOUNT_BANNED"
      });
    }
    
    if (user.is_active === 0) {
      return res.status(403).json({
        error: true,
        message: "Account inactive",
        code: "ACCOUNT_INACTIVE"
      });
    }
    
    // 5. Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);
    
    // 6. Return response
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          avatar_url: user.avatar_url
        },
        access_token: accessToken,
        refresh_token: refreshToken
      }
    });
  } catch (err) {
    console.error('Error in login:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      error: true,
      message: "Authorization token required",
      code: "UNAUTHORIZED"
    });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({
        error: true,
        message: "Invalid or expired authorization token",
        code: "UNAUTHORIZED"
      });
    }
    
    // Check if user is active/banned
    const dbUser = db.prepare('SELECT is_active, is_banned FROM users WHERE id = ?').get(user.user_id);
    if (!dbUser) {
      return res.status(401).json({
        error: true,
        message: "User not found",
        code: "UNAUTHORIZED"
      });
    }
    
    if (dbUser.is_banned === 1) {
      return res.status(403).json({
        error: true,
        message: "Account banned",
        code: "ACCOUNT_BANNED"
      });
    }
    
    if (dbUser.is_active === 0) {
      return res.status(403).json({
        error: true,
        message: "Account inactive",
        code: "ACCOUNT_INACTIVE"
      });
    }
    
    req.user = user;
    next();
  });
}

// Optional Authentication middleware
function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    req.user = null;
    return next();
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
      return next();
    }
    
    const dbUser = db.prepare('SELECT is_active, is_banned FROM users WHERE id = ?').get(user.user_id);
    if (dbUser && dbUser.is_banned === 0 && dbUser.is_active === 1) {
      req.user = user;
    } else {
      req.user = null;
    }
    next();
  });
}

// TASK 06: POST /api/auth/logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const { refresh_token } = req.body;
  
  if (!refresh_token || typeof refresh_token !== 'string') {
    return res.status(400).json({
      error: true,
      message: "Missing refresh token",
      code: "VALIDATION_ERROR"
    });
  }
  
  try {
    const hashedRefreshToken = crypto.createHash('sha256').update(refresh_token).digest('hex');
    
    // Delete the refresh token matching hash and user_id from access token
    db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ? AND user_id = ?')
      .run(hashedRefreshToken, req.user.user_id);
      
    return res.status(200).json({
      success: true,
      data: {
        message: "Logged out successfully"
      }
    });
  } catch (err) {
    console.error('Error in logout:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 07: POST /api/auth/refresh
app.post('/api/auth/refresh', rateLimit(30), (req, res) => {
  const { refresh_token } = req.body;
  
  if (!refresh_token || typeof refresh_token !== 'string') {
    return res.status(400).json({
      error: true,
      message: "Missing refresh_token",
      code: "VALIDATION_ERROR"
    });
  }
  
  try {
    const hashedRefreshToken = crypto.createHash('sha256').update(refresh_token).digest('hex');
    
    // Look up token
    const tokenRecord = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hashedRefreshToken);
    if (!tokenRecord) {
      return res.status(401).json({
        error: true,
        message: "Invalid, expired, or already used token",
        code: "INVALID_REFRESH_TOKEN"
      });
    }
    
    // Check if expired
    const now = new Date();
    const expiresAt = new Date(tokenRecord.expires_at);
    if (expiresAt < now) {
      db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(tokenRecord.id);
      return res.status(401).json({
        error: true,
        message: "Invalid, expired, or already used token",
        code: "INVALID_REFRESH_TOKEN"
      });
    }
    
    // Look up user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(tokenRecord.user_id);
    if (!user) {
      return res.status(401).json({
        error: true,
        message: "User not found",
        code: "INVALID_REFRESH_TOKEN"
      });
    }
    
    // Check status
    if (user.is_banned === 1) {
      return res.status(403).json({
        error: true,
        message: "Account banned",
        code: "ACCOUNT_BANNED"
      });
    }
    
    if (user.is_active === 0) {
      return res.status(403).json({
        error: true,
        message: "Account inactive",
        code: "ACCOUNT_INACTIVE"
      });
    }
    
    // Rotate token: delete old, generate new pair
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(tokenRecord.id);
    
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    
    return res.status(200).json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: newRefreshToken
      }
    });
  } catch (err) {
    console.error('Error in token refresh:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 08: POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', rateLimit(5), (req, res) => {
  const { email } = req.body;
  
  if (!email || typeof email !== 'string' || !validateEmail(email)) {
    return res.status(400).json({
      error: true,
      message: "Missing or invalid email",
      code: "VALIDATION_ERROR"
    });
  }
  
  try {
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    
    if (user) {
      const plainToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
      
      db.prepare('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
        .run(user.id, hashedToken, expiresAt);
        
      console.log(`[RESET TOKEN] user_id=${user.id} token=${plainToken} expires=${expiresAt}`);
    }
    
    return res.status(200).json({
      success: true,
      data: {
        message: "If that email is registered, a reset link has been sent."
      }
    });
  } catch (err) {
    console.error('Error in forgot password:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 09: POST /api/auth/reset-password
app.post('/api/auth/reset-password', rateLimit(10), async (req, res) => {
  const { token, new_password } = req.body;
  
  if (!token || typeof token !== 'string' || !new_password || typeof new_password !== 'string' || new_password.length < 8) {
    return res.status(400).json({
      error: true,
      message: "Missing token or password must be at least 8 characters long",
      code: "VALIDATION_ERROR"
    });
  }
  
  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const tokenRecord = db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?').get(hashedToken);
    
    if (!tokenRecord || tokenRecord.used === 1 || new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(400).json({
        error: true,
        message: "Token invalid, expired, or already used",
        code: "INVALID_RESET_TOKEN"
      });
    }
    
    const newHash = await bcrypt.hash(new_password, BCRYPT_SALT_ROUNDS);
    
    const resetTransaction = db.transaction(() => {
      db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
        .run(newHash, tokenRecord.user_id);
        
      db.prepare("UPDATE password_reset_tokens SET used = 1 WHERE id = ?")
        .run(tokenRecord.id);
        
      db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?")
        .run(tokenRecord.user_id);
    });
    
    resetTransaction();
    
    return res.status(200).json({
      success: true,
      data: {
        message: "Password updated successfully. Please log in."
      }
    });
  } catch (err) {
    console.error('Error in reset password:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 15: GET /api/home/feed
app.get('/api/home/feed', rateLimit(60), optionalAuthenticateToken, (req, res) => {
  try {
    const hour = new Date().getHours();
    let greeting = "Good evening";
    if (hour < 12) {
      greeting = "Good morning";
    } else if (hour < 17) {
      greeting = "Good afternoon";
    }
    
    const userId = req.user ? req.user.user_id : null;
    let queryStr = `
      SELECT 
        p.id, p.name, p.price_paise, p.ships_in_days, p.avg_rating, p.review_count, p.status, p.seller_id,
        COALESCE(
          (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1),
          (SELECT url FROM product_images WHERE product_id = p.id LIMIT 1)
        ) AS image_url,
        COALESCE(sp.shop_name, u.full_name) AS seller_name
    `;
    if (userId) {
      queryStr += `, (SELECT 1 FROM wishlists w WHERE w.user_id = ? AND w.product_id = p.id) IS NOT NULL AS is_wishlisted`;
    } else {
      queryStr += `, 0 AS is_wishlisted`;
    }
    queryStr += `
      FROM products p
      JOIN users u ON p.seller_id = u.id
      LEFT JOIN seller_profiles sp ON u.id = sp.user_id
      WHERE p.status = 'active'
      ORDER BY p.created_at DESC
      LIMIT 12
    `;
    
    const stmt = db.prepare(queryStr);
    const products = userId ? stmt.all(userId) : stmt.all();
    
    products.forEach(p => {
      p.is_wishlisted = !!p.is_wishlisted;
    });
    
    // Query all categories
    const categories = db.prepare("SELECT * FROM categories ORDER BY item_count DESC").all();
    
    return res.status(200).json({
      success: true,
      data: {
        greeting,
        featured_products: products,
        categories
      }
    });
  } catch (err) {
    console.error('Error in home feed:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 16: GET /api/categories
app.get('/api/categories', rateLimit(120), (req, res) => {
  try {
    const categories = db.prepare("SELECT * FROM categories ORDER BY item_count DESC").all();
    return res.status(200).json({
      success: true,
      data: {
        categories
      }
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 17: GET /api/categories/:slug/products
app.get('/api/categories/:slug/products', rateLimit(60), optionalAuthenticateToken, (req, res) => {
  const { slug } = req.params;
  const cursor = req.query.cursor;
  const limit = parseInt(req.query.limit) || 20;
  const sort = req.query.sort || 'newest';
  const sub = req.query.sub;
  
  try {
    // 1. Resolve category
    const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug);
    if (!category) {
      return res.status(404).json({
        error: true,
        message: "Category not found",
        code: "CATEGORY_NOT_FOUND"
      });
    }
    
    // 2. Build query
    let queryParts = [];
    let queryParams = [category.id];
    
    if (sub) {
      queryParts.push("(p.name LIKE ? OR p.description LIKE ?)");
      queryParams.push(`%${sub}%`, `%${sub}%`);
    }
    
    if (cursor) {
      const lastProduct = db.prepare("SELECT * FROM products WHERE id = ?").get(cursor);
      if (lastProduct) {
        if (sort === 'newest') {
          queryParts.push("(p.created_at < ? OR (p.created_at = ? AND p.id < ?))");
          queryParams.push(lastProduct.created_at, lastProduct.created_at, lastProduct.id);
        } else if (sort === 'price_asc') {
          queryParts.push("(p.price_paise > ? OR (p.price_paise = ? AND p.id > ?))");
          queryParams.push(lastProduct.price_paise, lastProduct.price_paise, lastProduct.id);
        } else if (sort === 'price_desc') {
          queryParts.push("(p.price_paise < ? OR (p.price_paise = ? AND p.id < ?))");
          queryParams.push(lastProduct.price_paise, lastProduct.price_paise, lastProduct.id);
        } else if (sort === 'top_rated') {
          queryParts.push("(p.avg_rating < ? OR (p.avg_rating = ? AND p.id < ?))");
          queryParams.push(lastProduct.avg_rating, lastProduct.avg_rating, lastProduct.id);
        }
      }
    }
    
    let orderBy = 'p.created_at DESC, p.id DESC';
    if (sort === 'price_asc') {
      orderBy = 'p.price_paise ASC, p.id ASC';
    } else if (sort === 'price_desc') {
      orderBy = 'p.price_paise DESC, p.id DESC';
    } else if (sort === 'top_rated') {
      orderBy = 'p.avg_rating DESC, p.id DESC';
    }
    
    let userId = req.user ? req.user.user_id : null;
    let sql = `
      SELECT 
        p.id, p.name, p.price_paise, p.ships_in_days, p.avg_rating, p.review_count, p.status, p.seller_id,
        COALESCE(
          (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1),
          (SELECT url FROM product_images WHERE product_id = p.id LIMIT 1)
        ) AS image_url,
        COALESCE(sp.shop_name, u.full_name) AS seller_name,
        (p.ships_in_days <= 1) AS ready_to_ship
    `;
    if (userId) {
      sql += `, (SELECT 1 FROM wishlists w WHERE w.user_id = ? AND w.product_id = p.id) IS NOT NULL AS is_wishlisted`;
    } else {
      sql += `, 0 AS is_wishlisted`;
    }
    sql += `
      FROM products p
      JOIN users u ON p.seller_id = u.id
      LEFT JOIN seller_profiles sp ON u.id = sp.user_id
      WHERE p.category_id = ? AND p.status = 'active'
    `;
    
    if (queryParts.length > 0) {
      sql += ' AND ' + queryParts.join(' AND ');
    }
    
    sql += ` ORDER BY ${orderBy} LIMIT ?`;
    
    let finalParams = [];
    if (userId) {
      finalParams.push(userId);
    }
    finalParams.push(category.id);
    finalParams.push(...queryParams.slice(1));
    finalParams.push(limit + 1); // Fetch limit + 1 to check if has_more
    
    const products = db.prepare(sql).all(...finalParams);
    
    const hasMore = products.length > limit;
    if (hasMore) {
      products.pop();
    }
    
    products.forEach(p => {
      p.is_wishlisted = !!p.is_wishlisted;
      p.ready_to_ship = !!p.ready_to_ship;
    });
    
    const nextCursor = hasMore && products.length > 0 ? String(products[products.length - 1].id) : null;
    
    return res.status(200).json({
      success: true,
      data: {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          item_count: category.item_count
        },
        products,
        next_cursor: nextCursor,
        has_more: hasMore
      }
    });
  } catch (err) {
    console.error('Error fetching category products:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 18: GET /api/products/search
app.get('/api/products/search', rateLimit(60), (req, res) => {
  const q = req.query.q;
  const cursor = req.query.cursor;
  const limit = parseInt(req.query.limit) || 20;
  
  if (!q || typeof q !== 'string' || q.trim() === '') {
    return res.status(400).json({
      error: true,
      message: "Query string q is required",
      code: "VALIDATION_ERROR"
    });
  }
  
  try {
    let queryParts = ["p.status = 'active'", "(p.name LIKE ? OR p.description LIKE ?)"];
    let queryParams = [`%${q}%`, `%${q}%`];
    
    if (cursor) {
      queryParts.push("p.id < ?");
      queryParams.push(parseInt(cursor));
    }
    
    let sql = `
      SELECT 
        p.id, p.name, p.price_paise, p.ships_in_days, p.avg_rating, p.seller_id,
        COALESCE(
          (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1),
          (SELECT url FROM product_images WHERE product_id = p.id LIMIT 1)
        ) AS image_url,
        COALESCE(sp.shop_name, u.full_name) AS seller_name
      FROM products p
      JOIN users u ON p.seller_id = u.id
      LEFT JOIN seller_profiles sp ON u.id = sp.user_id
      WHERE ${queryParts.join(' AND ')}
      ORDER BY p.id DESC
      LIMIT ?
    `;
    
    queryParams.push(limit + 1);
    
    const products = db.prepare(sql).all(...queryParams);
    const hasMore = products.length > limit;
    if (hasMore) {
      products.pop();
    }
    
    const nextCursor = hasMore && products.length > 0 ? String(products[products.length - 1].id) : null;
    
    return res.status(200).json({
      success: true,
      data: {
        query: q,
        products,
        next_cursor: nextCursor,
        has_more: hasMore
      }
    });
  } catch (err) {
    console.error('Error searching products:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 19: GET /api/products/:id
app.get('/api/products/:id', rateLimit(120), optionalAuthenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user ? req.user.user_id : null;
  
  try {
    // 1. SELECT product by id WHERE status != 'archived'
    let query = `
      SELECT 
        p.id, p.seller_id, p.category_id, p.name, p.description, p.price_paise, p.stock_qty, p.ships_in_days, p.avg_rating, p.review_count, p.status,
        c.name AS category_name, c.slug AS category_slug,
        COALESCE(sp.shop_name, u.full_name) AS seller_name, u.avatar_url, sp.shop_bio AS shop_tagline
    `;
    if (userId) {
      query += `, (SELECT 1 FROM wishlists w WHERE w.user_id = ? AND w.product_id = p.id) IS NOT NULL AS is_wishlisted`;
    } else {
      query += `, 0 AS is_wishlisted`;
    }
    query += `
      FROM products p
      JOIN users u ON p.seller_id = u.id
      LEFT JOIN seller_profiles sp ON u.id = sp.user_id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.status != 'archived'
    `;
    
    const stmt = db.prepare(query);
    const productData = userId ? stmt.get(userId, id) : stmt.get(id);
    
    if (!productData) {
      return res.status(404).json({
        error: true,
        message: "Product not found",
        code: "PRODUCT_NOT_FOUND"
      });
    }
    
    // 7. If stock_qty=0 set status to 'sold_out' in response
    let status = productData.status;
    if (productData.stock_qty === 0) {
      status = 'sold_out';
    }
    
    // 2. Join all images (order by sort_order)
    const images = db.prepare('SELECT url, is_primary, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC').all(id);
    
    // 5. Select 3 most recent reviews
    const recentReviews = db.prepare(`
      SELECT u.full_name AS reviewer_name, r.rating, r.body, r.created_at
      FROM reviews r
      JOIN users u ON r.reviewer_id = u.id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 3
    `).all(id);
    
    // Formatting response
    const productResponse = {
      id: productData.id,
      name: productData.name,
      description: productData.description,
      price_paise: productData.price_paise,
      stock_qty: productData.stock_qty,
      ships_in_days: productData.ships_in_days,
      avg_rating: productData.avg_rating,
      review_count: productData.review_count,
      is_wishlisted: !!productData.is_wishlisted,
      status: status,
      images: images,
      seller: {
        id: productData.seller_id,
        seller_name: productData.seller_name,
        avatar_url: productData.avatar_url,
        shop_tagline: productData.shop_tagline
      },
      category: {
        id: productData.category_id,
        name: productData.category_name,
        slug: productData.category_slug
      },
      recent_reviews: recentReviews
    };
    
    return res.status(200).json({
      success: true,
      data: productResponse
    });
  } catch (err) {
    console.error('Error fetching product details:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 20: GET /api/cart
app.get('/api/cart', rateLimit(60), authenticateToken, (req, res) => {
  const userId = req.user.user_id;
  
  try {
    const sql = `
      SELECT 
        ci.id, ci.product_id, ci.quantity,
        p.name, p.price_paise, p.stock_qty, p.ships_in_days, p.seller_id,
        COALESCE(
          (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1),
          (SELECT url FROM product_images WHERE product_id = p.id LIMIT 1)
        ) AS image_url,
        COALESCE(sp.shop_name, u.full_name) AS seller_name
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      JOIN users u ON p.seller_id = u.id
      LEFT JOIN seller_profiles sp ON u.id = sp.user_id
      WHERE ci.user_id = ? AND p.status != 'archived'
    `;
    
    const items = db.prepare(sql).all(userId);
    
    items.forEach(item => {
      item.quantity_warning = item.quantity > item.stock_qty;
    });
    
    const subtotal_paise = items.reduce((sum, item) => sum + item.price_paise * item.quantity, 0);
    const item_count = items.reduce((sum, item) => sum + item.quantity, 0);
    
    const shipping_paise = (subtotal_paise === 0) ? 0 : (subtotal_paise < 50000 ? 12000 : 0);
    const total_paise = subtotal_paise + shipping_paise;
    
    return res.status(200).json({
      success: true,
      data: {
        items,
        item_count,
        subtotal_paise,
        shipping_paise,
        total_paise
      }
    });
  } catch (err) {
    console.error('Error fetching cart:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 21: POST /api/cart/items
app.post('/api/cart/items', rateLimit(60), authenticateToken, (req, res) => {
  const userId = req.user.user_id;
  const { product_id, quantity } = req.body;
  
  if (product_id === undefined || product_id === null || !Number.isInteger(product_id)) {
    return res.status(400).json({
      error: true,
      message: "product_id must be an integer",
      code: "VALIDATION_ERROR"
    });
  }
  
  if (quantity === undefined || quantity === null || !Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({
      error: true,
      message: "quantity must be an integer >= 1",
      code: "VALIDATION_ERROR"
    });
  }
  
  try {
    // 1. Validate product exists and is active
    const product = db.prepare('SELECT status, stock_qty FROM products WHERE id = ?').get(product_id);
    if (!product || product.status === 'archived') {
      return res.status(404).json({
        error: true,
        message: "Product not found or not active",
        code: "PRODUCT_NOT_FOUND"
      });
    }
    if (product.status !== 'active') {
      return res.status(404).json({
        error: true,
        message: "Product not found or not active",
        code: "PRODUCT_NOT_FOUND"
      });
    }
    
    // 2. Check quantity <= stock_qty
    if (quantity > product.stock_qty) {
      return res.status(422).json({
        error: true,
        message: "Requested quantity exceeds stock",
        code: "INSUFFICIENT_STOCK"
      });
    }
    
    // 3. Check if duplicate
    const existing = db.prepare('SELECT id FROM cart_items WHERE user_id = ? AND product_id = ?').get(userId, product_id);
    if (existing) {
      return res.status(409).json({
        error: true,
        message: "Item already in cart — use PATCH to update quantity",
        code: "CART_ITEM_EXISTS"
      });
    }
    
    const info = db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)')
      .run(userId, product_id, quantity);
      
    const cartItemId = info.lastInsertRowid;
    
    const itemCount = db.prepare('SELECT SUM(quantity) as count FROM cart_items WHERE user_id = ?').get(userId).count || 0;
    
    return res.status(200).json({
      success: true,
      data: {
        cart_item_id: cartItemId,
        item_count: itemCount
      }
    });
  } catch (err) {
    console.error('Error adding to cart:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 22: PATCH /api/cart/items/:id
app.patch('/api/cart/items/:id', rateLimit(120), authenticateToken, (req, res) => {
  const userId = req.user.user_id;
  const { id } = req.params;
  const { quantity } = req.body;
  
  if (quantity === undefined || quantity === null || !Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({
      error: true,
      message: "quantity must be an integer >= 1",
      code: "VALIDATION_ERROR"
    });
  }
  
  try {
    const cartItem = db.prepare('SELECT * FROM cart_items WHERE id = ?').get(id);
    if (!cartItem) {
      return res.status(404).json({
        error: true,
        message: "Cart item not found",
        code: "CART_ITEM_NOT_FOUND"
      });
    }
    
    if (cartItem.user_id !== userId) {
      return res.status(403).json({
        error: true,
        message: "Not your cart item",
        code: "FORBIDDEN"
      });
    }
    
    const product = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(cartItem.product_id);
    if (!product) {
      return res.status(404).json({
        error: true,
        message: "Product not found",
        code: "PRODUCT_NOT_FOUND"
      });
    }
    
    if (quantity > product.stock_qty) {
      return res.status(422).json({
        error: true,
        message: "Requested quantity exceeds stock",
        code: "INSUFFICIENT_STOCK"
      });
    }
    
    db.prepare('UPDATE cart_items SET quantity = ?, added_at = CURRENT_TIMESTAMP WHERE id = ?').run(quantity, id);
    
    return res.status(200).json({
      success: true,
      data: {
        id: parseInt(id),
        quantity
      }
    });
  } catch (err) {
    console.error('Error updating cart item:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 23: DELETE /api/cart/items/:id
app.delete('/api/cart/items/:id', rateLimit(120), authenticateToken, (req, res) => {
  const userId = req.user.user_id;
  const { id } = req.params;
  
  try {
    const cartItem = db.prepare('SELECT user_id FROM cart_items WHERE id = ?').get(id);
    if (!cartItem) {
      return res.status(404).json({
        error: true,
        message: "Cart item not found",
        code: "CART_ITEM_NOT_FOUND"
      });
    }
    
    if (cartItem.user_id !== userId) {
      return res.status(403).json({
        error: true,
        message: "Not your cart item",
        code: "FORBIDDEN"
      });
    }
    
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(id);
    
    const itemCount = db.prepare('SELECT SUM(quantity) as count FROM cart_items WHERE user_id = ?').get(userId).count || 0;
    
    return res.status(200).json({
      success: true,
      data: {
        item_count: itemCount
      }
    });
  } catch (err) {
    console.error('Error deleting cart item:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 24: GET /api/addresses
app.get('/api/addresses', rateLimit(60), authenticateToken, (req, res) => {
  const userId = req.user.user_id;
  
  try {
    const addresses = db.prepare('SELECT id, full_name, line1, line2, city, state, pincode, phone, is_default FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').all(userId);
    
    return res.status(200).json({
      success: true,
      data: {
        addresses
      }
    });
  } catch (err) {
    console.error('Error fetching addresses:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 25: POST /api/addresses
app.post('/api/addresses', rateLimit(60), authenticateToken, (req, res) => {
  const userId = req.user.user_id;
  const { full_name, line1, line2, city, state, pincode, phone, is_default } = req.body;
  
  if (!full_name || typeof full_name !== 'string' || full_name.trim() === '' ||
      !line1 || typeof line1 !== 'string' || line1.trim() === '' ||
      !city || typeof city !== 'string' || city.trim() === '' ||
      !state || typeof state !== 'string' || state.trim() === '' ||
      !pincode || typeof pincode !== 'string' || pincode.trim() === '') {
    return res.status(400).json({
      error: true,
      message: "full_name, line1, city, state, and pincode are required",
      code: "VALIDATION_ERROR"
    });
  }
  
  const finalLine2 = (line2 && typeof line2 === 'string') ? line2 : null;
  const finalPhone = (phone && typeof phone === 'string') ? phone : null;
  const isDefaultVal = is_default ? 1 : 0;
  
  try {
    const insertTransaction = db.transaction(() => {
      if (isDefaultVal === 1) {
        db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(userId);
      }
      
      const info = db.prepare(`
        INSERT INTO addresses (user_id, full_name, line1, line2, city, state, pincode, phone, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, full_name, line1, finalLine2, city, state, pincode, finalPhone, isDefaultVal);
      
      return info.lastInsertRowid;
    });
    
    const addressId = insertTransaction();
    
    return res.status(201).json({
      success: true,
      data: {
        id: addressId,
        full_name,
        line1,
        line2: finalLine2,
        city,
        state,
        pincode,
        phone: finalPhone,
        is_default: isDefaultVal
      }
    });
  } catch (err) {
    console.error('Error creating address:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 26: PUT /api/addresses/:id
app.put('/api/addresses/:id', rateLimit(60), authenticateToken, (req, res) => {
  const userId = req.user.user_id;
  const { id } = req.params;
  const { full_name, line1, line2, city, state, pincode, phone, is_default } = req.body;
  
  if (!full_name || typeof full_name !== 'string' || full_name.trim() === '' ||
      !line1 || typeof line1 !== 'string' || line1.trim() === '' ||
      !city || typeof city !== 'string' || city.trim() === '' ||
      !state || typeof state !== 'string' || state.trim() === '' ||
      !pincode || typeof pincode !== 'string' || pincode.trim() === '') {
    return res.status(400).json({
      error: true,
      message: "full_name, line1, city, state, and pincode are required",
      code: "VALIDATION_ERROR"
    });
  }
  
  const finalLine2 = (line2 && typeof line2 === 'string') ? line2 : null;
  const finalPhone = (phone && typeof phone === 'string') ? phone : null;
  const isDefaultVal = is_default ? 1 : 0;
  
  try {
    const address = db.prepare('SELECT user_id FROM addresses WHERE id = ?').get(id);
    if (!address) {
      return res.status(404).json({
        error: true,
        message: "Address not found",
        code: "ADDRESS_NOT_FOUND"
      });
    }
    
    if (address.user_id !== userId) {
      return res.status(403).json({
        error: true,
        message: "Not your address",
        code: "FORBIDDEN"
      });
    }
    
    const updateTransaction = db.transaction(() => {
      if (isDefaultVal === 1) {
        db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(userId);
      }
      
      db.prepare(`
        UPDATE addresses 
        SET full_name = ?, line1 = ?, line2 = ?, city = ?, state = ?, pincode = ?, phone = ?, is_default = ?
        WHERE id = ?
      `).run(full_name, line1, finalLine2, city, state, pincode, finalPhone, isDefaultVal, id);
    });
    
    updateTransaction();
    
    return res.status(200).json({
      success: true,
      data: {
        id: parseInt(id),
        full_name,
        line1,
        line2: finalLine2,
        city,
        state,
        pincode,
        phone: finalPhone,
        is_default: isDefaultVal
      }
    });
  } catch (err) {
    console.error('Error updating address:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 27: DELETE /api/addresses/:id
app.delete('/api/addresses/:id', rateLimit(60), authenticateToken, (req, res) => {
  const userId = req.user.user_id;
  const { id } = req.params;
  
  try {
    const address = db.prepare('SELECT user_id FROM addresses WHERE id = ?').get(id);
    if (!address) {
      return res.status(404).json({
        error: true,
        message: "Address not found",
        code: "ADDRESS_NOT_FOUND"
      });
    }
    
    if (address.user_id !== userId) {
      return res.status(403).json({
        error: true,
        message: "Not your address",
        code: "FORBIDDEN"
      });
    }
    
    db.prepare('DELETE FROM addresses WHERE id = ?').run(id);
    
    return res.status(200).json({
      success: true
    });
  } catch (err) {
    console.error('Error deleting address:', err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// TASK 28: POST /api/orders
app.post('/api/orders', rateLimit(10), authenticateToken, async (req, res) => {
  const userId = req.user.user_id;
  const { address_id, cart_item_ids } = req.body;
  
  if (address_id === undefined || address_id === null) {
    return res.status(400).json({
      error: true,
      message: "address_id required",
      code: "VALIDATION_ERROR"
    });
  }
  
  try {
    // 1. Validate address belongs to user
    const address = db.prepare('SELECT id, user_id FROM addresses WHERE id = ?').get(address_id);
    if (!address || address.user_id !== userId) {
      return res.status(404).json({
        error: true,
        message: "Address not found",
        code: "ADDRESS_NOT_FOUND"
      });
    }
    
    // 2. Fetch cart items (or specified subset)
    let cartItems = [];
    if (cart_item_ids && Array.isArray(cart_item_ids) && cart_item_ids.length > 0) {
      const placeholders = cart_item_ids.map(() => '?').join(',');
      const sql = `
        SELECT ci.id, ci.product_id, ci.quantity, p.name, p.price_paise, p.stock_qty, p.status,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS image_url
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ? AND ci.id IN (${placeholders}) AND p.status != 'archived'
      `;
      cartItems = db.prepare(sql).all(userId, ...cart_item_ids);
      if (cartItems.length !== cart_item_ids.length) {
        return res.status(422).json({
          error: true,
          message: "Cart items out of stock or not found",
          code: "INVALID_CART_ITEMS"
        });
      }
    } else {
      const sql = `
        SELECT ci.id, ci.product_id, ci.quantity, p.name, p.price_paise, p.stock_qty, p.status,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS image_url
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ? AND p.status != 'archived'
      `;
      cartItems = db.prepare(sql).all(userId);
    }
    
    if (cartItems.length === 0) {
      return res.status(422).json({
        error: true,
        message: "Cart is empty / items out of stock",
        code: "EMPTY_CART"
      });
    }
    
    // 3. Verify stock_qty >= quantity
    for (const item of cartItems) {
      if (item.quantity > item.stock_qty || item.status !== 'active') {
        return res.status(422).json({
          error: true,
          message: `Requested quantity exceeds stock for ${item.name}`,
          code: "INSUFFICIENT_STOCK"
        });
      }
    }
    
    // 4. Calculate subtotal, shipping
    const subtotal_paise = cartItems.reduce((sum, item) => sum + item.price_paise * item.quantity, 0);
    const shipping_paise = subtotal_paise >= 50000 ? 0 : 12000;
    const total_paise = subtotal_paise + shipping_paise;
    
    // 5. Generate order_ref
    const year = new Date().getFullYear();
    const order_ref = `TF-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // 8. Create Razorpay order (or mock)
    let razorpayOrderId = null;
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      try {
        const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
        const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`
          },
          body: JSON.stringify({
            amount: total_paise,
            currency: 'INR',
            receipt: order_ref
          })
        });
        if (rpRes.ok) {
          const rpData = await rpRes.json();
          razorpayOrderId = rpData.id;
        }
      } catch (err) {
        console.error('Error generating real Razorpay order ID:', err);
      }
    }
    
    if (!razorpayOrderId) {
      razorpayOrderId = 'order_' + crypto.randomBytes(8).toString('hex');
    }
    
    // 6, 7, 9. INSERT order and order_items, delete cart items
    const orderId = db.transaction(() => {
      const orderInfo = db.prepare(`
        INSERT INTO orders (order_ref, buyer_id, address_id, status, subtotal_paise, shipping_paise, total_paise, razorpay_order_id)
        VALUES (?, ?, ?, 'Awaiting Payment', ?, ?, ?, ?)
      `).run(order_ref, userId, address_id, subtotal_paise, shipping_paise, total_paise, razorpayOrderId);
      
      const oId = orderInfo.lastInsertRowid;
      
      const insertOrderItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price_paise, quantity, image_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      for (const item of cartItems) {
        insertOrderItem.run(oId, item.product_id, item.name, item.price_paise, item.quantity, item.image_url);
      }
      
      const cartItemIds = cartItems.map(item => item.id);
      const placeholders = cartItemIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM cart_items WHERE id IN (${placeholders})`).run(...cartItemIds);
      
      return oId;
    })();
    
    const itemsFormatted = cartItems.map(item => ({
      product_name: item.name,
      quantity: item.quantity,
      unit_price_paise: item.price_paise,
      image_url: item.image_url
    }));
    
    return res.status(200).json({
      success: true,
      data: {
        order_id: orderId,
        order_ref,
        status: 'Awaiting Payment',
        items: itemsFormatted,
        subtotal_paise,
        shipping_paise,
        total_paise,
        razorpay_order_id: razorpayOrderId
      }
    });
  } catch (err) {
    console.error('Error creating order:', err);
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
