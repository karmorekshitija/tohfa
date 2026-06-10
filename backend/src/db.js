const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'tohfa.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Task 01: Migration for users table
const migrateUsers = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('buyer','seller','admin')),
      avatar_url TEXT DEFAULT NULL,
      is_active INTEGER DEFAULT 1,
      is_banned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `);
};

migrateUsers();

// Task 48 columns migration for users
try {
  db.exec("ALTER TABLE users ADD COLUMN display_name TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN bio TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN location TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN ships_in_days INTEGER DEFAULT 3;");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN instagram_handle TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN phone TEXT;");
} catch (e) {}

// Task 02: Migration for refresh_tokens table
const migrateRefreshTokens = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rt_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_rt_token_hash ON refresh_tokens(token_hash);
  `);
};

migrateRefreshTokens();

// Task 04: Migration for seller_profiles table
const migrateSellerProfiles = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seller_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      shop_name TEXT NOT NULL,
      shop_bio TEXT DEFAULT NULL,
      ships_in_days INTEGER DEFAULT 7,
      instagram_handle TEXT DEFAULT NULL,
      is_approved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sp_user_id ON seller_profiles(user_id);
  `);
};

migrateSellerProfiles();

// Task 08: Migration for password_reset_tokens table
const migratePasswordResetTokens = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
};

migratePasswordResetTokens();

// Task 01: Migration for categories table
const migrateCategories = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      slug        TEXT NOT NULL UNIQUE,
      description TEXT,
      icon_emoji  TEXT,
      item_count  INTEGER DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
  `);

  const count = db.prepare("SELECT COUNT(*) as count FROM categories").get().count;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO categories (name, slug, description, icon_emoji, item_count)
      VALUES (?, ?, ?, ?, 0)
    `);
    const seed = [
      ['Textile Arts', 'textile-arts', 'Crochet, knitting, weaving & loom work', '🧶'],
      ['Jewellery', 'jewellery', 'Handcrafted rings, necklaces & bangles', '💍'],
      ['Ceramics & Pottery', 'ceramics-pottery', 'Wheel-thrown stoneware & hand-built clay', '🏺'],
      ['Journals & Stationery', 'journals-stationery', 'Notebooks, journals & hand-pressed cards', '📓'],
      ['Candles & Fragrance', 'candles-fragrance', 'Soy candles, incense & botanical wax', '🕯️'],
      ['Paintings', 'paintings', 'Original artwork & hand-illustrated prints', '🖼️'],
      ['Customized Gifts', 'customized-gifts', 'Personalised & bespoke handmade pieces', '🎁'],
      ['Home Decor', 'home-decor', 'Hand-carved, woven & crafted home objects', '🏡']
    ];
    const insertTransaction = db.transaction((data) => {
      for (const row of data) {
        insert.run(row[0], row[1], row[2], row[3]);
      }
    });
    insertTransaction(seed);
  }
};

migrateCategories();

// Task 02: Migration for products table
const migrateProducts = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id       INTEGER NOT NULL REFERENCES users(id),
      category_id     INTEGER REFERENCES categories(id),
      name            TEXT NOT NULL,
      description     TEXT,
      price_paise     INTEGER NOT NULL,
      stock_qty       INTEGER DEFAULT 0,
      ships_in_days   INTEGER DEFAULT 3,
      status          TEXT DEFAULT 'active',
      ready_to_ship   INTEGER DEFAULT 0,
      avg_rating      REAL DEFAULT 0,
      review_count    INTEGER DEFAULT 0,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
  `);
};

migrateProducts();

try {
  db.exec("ALTER TABLE products ADD COLUMN ready_to_ship INTEGER DEFAULT 0;");
} catch (e) {}

// Task 03: Migration for product_images table
const migrateProductImages = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_images (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      url         TEXT NOT NULL,
      is_primary  INTEGER DEFAULT 0,
      sort_order  INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
  `);
};

migrateProductImages();

// Task 04: Migration for cart_items table
const migrateCartItems = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity    INTEGER NOT NULL DEFAULT 1,
      added_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
  `);
};

migrateCartItems();

// Task 05: Migration for addresses table
const migrateAddresses = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS addresses (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name     TEXT NOT NULL,
      line1         TEXT NOT NULL,
      line2         TEXT,
      city          TEXT NOT NULL,
      state         TEXT NOT NULL,
      pincode       TEXT NOT NULL,
      phone         TEXT,
      is_default    INTEGER DEFAULT 0,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
  `);
};

migrateAddresses();

// Legacy orders, order_items, and reviews migrations removed for Part 4 recreation.
const migrateOrderItems = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id  INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      unit_price_paise INTEGER NOT NULL,
      quantity    INTEGER NOT NULL DEFAULT 1,
      image_url   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
  `);
};
migrateOrderItems();


// Task 09: Migration for wishlists table
const migrateWishlists = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wishlists (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      added_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlists(user_id);
  `);
};

migrateWishlists();

// Legacy reels migration removed for Part 4 recreation.

// Task 11: Migration for reel_likes table
const migrateReelLikes = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reel_likes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      reel_id   INTEGER NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      liked_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(reel_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_reel_likes_reel ON reel_likes(reel_id);
  `);
};

migrateReelLikes();

// Task 12: Migration for reel_comments table
const migrateReelComments = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reel_comments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      reel_id       INTEGER NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body          TEXT NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reel_comments_reel ON reel_comments(reel_id);
  `);
};

migrateReelComments();

// Task 13: Migration for saved_reels table
const migrateSavedReels = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_reels (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      reel_id   INTEGER NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      saved_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(reel_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_saved_reels_user ON saved_reels(user_id);
  `);
};

migrateSavedReels();

// Task 14: Migration for follows table
const migrateFollows = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS follows (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    );
    CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
  `);
};

migrateFollows();

// Task 54: Migration for notifications table
const migrateNotifications = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       TEXT NOT NULL,
      message    TEXT NOT NULL,
      icon       TEXT DEFAULT 'notifications',
      link_url   TEXT,
      is_read    INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);
};

migrateNotifications();

// ============================================================
// PART 4: SELLER STUDIO MIGRATIONS
// ============================================================

// Task 01: listings table migration
const migrateListings = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id                    INTEGER  PRIMARY KEY AUTOINCREMENT,
      seller_id             INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title                 TEXT     NOT NULL,
      primary_name          TEXT     DEFAULT NULL,
      primary_medium        TEXT     DEFAULT NULL,
      description           TEXT     DEFAULT NULL,
      story                 TEXT     DEFAULT NULL,
      base_price            INTEGER  NOT NULL DEFAULT 0,   -- in paise
      price_paise           INTEGER  NOT NULL DEFAULT 0,   -- in paise, compatibility
      listing_type          TEXT     NOT NULL DEFAULT 'pre-made' CHECK(listing_type IN ('pre-made','custom')),
      status                TEXT     NOT NULL DEFAULT 'draft' CHECK(status IN ('active','paused','draft','deleted')),
      ships_in_days         INTEGER  NOT NULL DEFAULT 3,
      dispatch_sla_days     INTEGER  NOT NULL DEFAULT 1,
      daily_max_slots       INTEGER  DEFAULT NULL,
      weekly_cap            INTEGER  DEFAULT NULL,
      monthly_ceiling       INTEGER  DEFAULT NULL,
      allow_prebooking      INTEGER  DEFAULT 0,
      prebooking_window     TEXT     DEFAULT NULL,
      min_order_qty         INTEGER  DEFAULT 1,
      max_order_qty         INTEGER  DEFAULT NULL,
      weight_g              INTEGER  DEFAULT NULL,
      weight_grams          INTEGER  DEFAULT NULL,
      length_cm             REAL     DEFAULT NULL,
      width_cm              REAL     DEFAULT NULL,
      height_cm             REAL     DEFAULT NULL,
      shipping_method       TEXT     DEFAULT 'courier' CHECK(shipping_method IN ('courier','local','pickup')),
      packaging_type        TEXT     DEFAULT 'standard' CHECK(packaging_type IN ('standard','branded','eco','fragile')),
      return_policy         TEXT     DEFAULT 'no-returns' CHECK(return_policy IN ('no-returns','7-day','15-day')),
      is_eco_friendly       INTEGER  DEFAULT 0,
      festive_tags          TEXT     DEFAULT NULL,   -- JSON array of strings e.g. '["Diwali","Wedding"]'
      category              TEXT     DEFAULT NULL,
      tags                  TEXT     DEFAULT NULL,
      badges                TEXT     DEFAULT NULL,
      published_at          TEXT     DEFAULT NULL,
      stock_count           INTEGER  NOT NULL DEFAULT 0,
      sku                   TEXT     DEFAULT NULL,
      processing_time       TEXT     DEFAULT NULL,
      gift_wrap_available   INTEGER  DEFAULT 0,
      gift_wrap_price_paise INTEGER  DEFAULT 0,
      handwritten_note      INTEGER  DEFAULT 0,
      shipping_profile_id   INTEGER  DEFAULT NULL,
      listing_score         INTEGER  DEFAULT 0,
      view_count            INTEGER  DEFAULT 0,
      sale_count            INTEGER  DEFAULT 0,
      cover_photo_url       TEXT     DEFAULT NULL,
      created_at            TEXT     DEFAULT (datetime('now')),
      updated_at            TEXT     DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON listings(seller_id);
    CREATE INDEX IF NOT EXISTS idx_listings_status    ON listings(status);
  `);
};
migrateListings();

// Task 02: listing_variants table migration
const migrateListingVariants = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listing_variants (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id    INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      variant_name  TEXT    NOT NULL,   -- e.g. "Crimson Red", "Medium 10x10"
      price_paise   INTEGER DEFAULT NULL,   -- if NULL, inherits listing.base_price
      stock_count   INTEGER NOT NULL DEFAULT 0,
      sku           TEXT    DEFAULT NULL,
      material_cost INTEGER DEFAULT 0,   -- in paise
      created_at    TEXT    DEFAULT (datetime('now')),
      updated_at    TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_variants_listing_id ON listing_variants(listing_id);
  `);
};
migrateListingVariants();

// Task 03: listing_images table migration
const migrateListingImages = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listing_images (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id  INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      image_url   TEXT    NOT NULL,
      is_cover    INTEGER NOT NULL DEFAULT 0,   -- 1 = main cover photo
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_images_listing_id ON listing_images(listing_id);

    CREATE TABLE IF NOT EXISTS listing_photos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id  INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      url         TEXT    NOT NULL,
      is_cover    INTEGER DEFAULT 0,
      is_video    INTEGER DEFAULT 0,
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_photos_listing_id ON listing_photos(listing_id);
  `);
};
migrateListingImages();

// Task 04: orders table migration (seller-facing view)
const migrateOrders = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id                  INTEGER  PRIMARY KEY AUTOINCREMENT,
      order_ref           TEXT     NOT NULL UNIQUE,   -- e.g. TF-0042
      buyer_id            INTEGER  NOT NULL REFERENCES users(id),
      seller_id           INTEGER  REFERENCES users(id),
      listing_id          INTEGER  REFERENCES listings(id),
      variant_id          INTEGER  DEFAULT NULL REFERENCES listing_variants(id),
      quantity            INTEGER  NOT NULL DEFAULT 1,
      unit_price          INTEGER,   -- in paise, price at time of order
      total_amount        INTEGER,   -- in paise
      platform_fee        INTEGER,   -- 8% in paise
      seller_payout       INTEGER,   -- total_amount - platform_fee
      order_type          TEXT     NOT NULL DEFAULT 'pre-made' CHECK(order_type IN ('pre-made','custom')),
      status              TEXT     NOT NULL DEFAULT 'awaiting_payment'
                                   CHECK(status IN (
                                     'awaiting_payment','processing','in_production',
                                     'packed','dispatched','delivered','cancelled','rto',
                                     'Awaiting Payment','Processing','Dispatched','Delivered','Cancelled',
                                     'in_transit','on_hold'
                                   )),
      payment_status      TEXT     NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid','refunded')),
      customization       TEXT     DEFAULT NULL,   -- JSON blob of custom instructions
      tracking_id         TEXT     DEFAULT NULL,
      courier             TEXT     DEFAULT NULL,
      deadline_at         TEXT     DEFAULT NULL,
      dispatched_at       TEXT     DEFAULT NULL,
      delivered_at        TEXT     DEFAULT NULL,
      cancel_reason       TEXT     DEFAULT NULL,
      cancelled_at        TEXT     DEFAULT NULL,
      studio_notes        TEXT     DEFAULT NULL,   -- JSON array of note objects {ts, text}
      total_paise         INTEGER  DEFAULT 0,
      subtotal_paise      INTEGER  DEFAULT 0,
      shipping_paise      INTEGER  DEFAULT 0,
      address_id          INTEGER  DEFAULT NULL,
      razorpay_order_id   TEXT     DEFAULT NULL,
      razorpay_payment_id TEXT     DEFAULT NULL,
      created_at          TEXT     DEFAULT (datetime('now')),
      updated_at          TEXT     DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  `);
};
migrateOrders();

// Task 05: inventory_materials table migration
const migrateInventoryMaterials = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_materials (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      material_name  TEXT    NOT NULL,   -- e.g. "Merino Wool (Mustard)", "10\\" Clay Pot"
      quantity_g_pcs REAL    NOT NULL DEFAULT 0.0,   -- weight in grams or piece count
      unit           TEXT    NOT NULL CHECK(unit IN ('grams','pcs')),
      cost_per_unit  INTEGER NOT NULL DEFAULT 0,   -- in paise
      low_stock_threshold REAL DEFAULT 0.0,
      stock_qty      REAL    DEFAULT 0.0,
      min_threshold  REAL    DEFAULT 0.0,
      supplier_name  TEXT    DEFAULT NULL,
      supplier_phone TEXT    DEFAULT NULL,
      last_restocked TEXT    DEFAULT (datetime('now')),
      created_at     TEXT    DEFAULT (datetime('now')),
      updated_at     TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_materials_seller ON inventory_materials(seller_id);
  `);
};
migrateInventoryMaterials();

// Task 06: reels table migration
const migrateReels = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reels (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id    INTEGER REFERENCES products(id),
      title         TEXT,
      caption       TEXT    DEFAULT NULL,
      video_url     TEXT    NOT NULL,
      thumbnail_url TEXT    DEFAULT NULL,
      duration_secs INTEGER DEFAULT NULL,
      share_to_instagram INTEGER DEFAULT 0,
      reel_type     TEXT    DEFAULT NULL CHECK(reel_type IN ('process','behind_the_scenes','storytime','qa','tutorial','other','showcase')),
      seasonal_tag  TEXT    DEFAULT NULL,
      visibility    TEXT    DEFAULT 'draft' CHECK(visibility IN ('public','store-only','draft')),
      ig_reminder   INTEGER DEFAULT 0,
      view_count    INTEGER DEFAULT 0,
      like_count    INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      save_count    INTEGER DEFAULT 0,
      status        TEXT    DEFAULT 'active',
      created_at    TEXT    DEFAULT (datetime('now')),
      updated_at    TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reels_seller ON reels(seller_id);

    CREATE TABLE IF NOT EXISTS reel_listing_links (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      reel_id    INTEGER NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      created_at TEXT    DEFAULT (datetime('now')),
      UNIQUE(reel_id, listing_id)
    );
    CREATE INDEX IF NOT EXISTS idx_rll_reel ON reel_listing_links(reel_id);
  `);
};
migrateReels();

// Ensure columns exist on legacy reels tables
try {
  db.exec("ALTER TABLE reels ADD COLUMN like_count INTEGER DEFAULT 0;");
} catch (e) {}
try {
  db.exec("ALTER TABLE reels ADD COLUMN comment_count INTEGER DEFAULT 0;");
} catch (e) {}
try {
  db.exec("ALTER TABLE reels ADD COLUMN save_count INTEGER DEFAULT 0;");
} catch (e) {}
try {
  db.exec("ALTER TABLE reels ADD COLUMN status TEXT DEFAULT 'active';");
} catch (e) {}
try {
  db.exec("ALTER TABLE reels ADD COLUMN product_id INTEGER REFERENCES products(id);");
} catch (e) {}

// Task 07: reviews table migration
const migrateReviews = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id        INTEGER REFERENCES orders(id),
      buyer_id        INTEGER REFERENCES users(id),
      seller_id       INTEGER REFERENCES users(id),
      listing_id      INTEGER REFERENCES listings(id),
      product_id      INTEGER REFERENCES products(id),
      reviewer_id     INTEGER REFERENCES users(id),
      rating          INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      body            TEXT,
      comment_text    TEXT    DEFAULT NULL,
      reply_text      TEXT    DEFAULT NULL,   -- seller reply
      replied_at      TEXT    DEFAULT NULL,
      created_at      TEXT    DEFAULT (datetime('now')),
      updated_at      TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_listing ON reviews(listing_id);

    CREATE TABLE IF NOT EXISTS review_request_settings (
      seller_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled             INTEGER NOT NULL DEFAULT 1,   -- send automated requests
      delay_days_after_del INTEGER NOT NULL DEFAULT 3,
      custom_subject      TEXT    DEFAULT NULL,
      custom_message      TEXT    DEFAULT NULL,
      updated_at          TEXT    DEFAULT (datetime('now'))
    );
  `);
};
migrateReviews();

try {
  db.exec("ALTER TABLE reviews ADD COLUMN product_id INTEGER REFERENCES products(id);");
} catch (e) {}
try {
  db.exec("ALTER TABLE reviews ADD COLUMN reviewer_id INTEGER REFERENCES users(id);");
} catch (e) {}
try {
  db.exec("ALTER TABLE reviews ADD COLUMN body TEXT;");
} catch (e) {}

// Task 08: store_config, store_workspace_photos, payout_history migrations
const migrateStoreConfig = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_config (
      seller_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      accept_orders     INTEGER NOT NULL DEFAULT 1,
      vacation_mode     INTEGER NOT NULL DEFAULT 0,
      vacation_note     TEXT    DEFAULT NULL,
      estimated_dispatch_sla_days INTEGER NOT NULL DEFAULT 2,
      packaging_fee_paise INTEGER NOT NULL DEFAULT 0,
      wrap_fee_paise      INTEGER NOT NULL DEFAULT 0,
      zai_mode_enabled  INTEGER NOT NULL DEFAULT 0,
      banner_url        TEXT    DEFAULT NULL,
      about_headline    TEXT    DEFAULT NULL,
      artisan_story     TEXT    DEFAULT NULL,
      current_balance_paise INTEGER NOT NULL DEFAULT 0,   -- updated on payouts or completed sales
      tagline           TEXT    DEFAULT NULL,
      artist_bio        TEXT    DEFAULT NULL,
      whatsapp_business TEXT    DEFAULT NULL,
      city              TEXT    DEFAULT NULL,
      specializations   TEXT    DEFAULT NULL,   -- JSON array of strings
      bank_account_holder TEXT  DEFAULT NULL,
      bank_name         TEXT    DEFAULT NULL,
      bank_account_number TEXT  DEFAULT NULL,
      gstin             TEXT    DEFAULT NULL,
      gstin_verified    INTEGER DEFAULT 0,
      notif_new_order_email   INTEGER DEFAULT 1,
      notif_new_order_wa      INTEGER DEFAULT 1,
      notif_new_order_inapp   INTEGER DEFAULT 1,
      notif_cancelled_email   INTEGER DEFAULT 1,
      notif_cancelled_wa      INTEGER DEFAULT 1,
      notif_cancelled_inapp   INTEGER DEFAULT 1,
      notif_stock_warn_email  INTEGER DEFAULT 1,
      notif_stock_warn_wa     INTEGER DEFAULT 1,
      notif_stock_warn_inapp  INTEGER DEFAULT 1,
      notif_payout_email      INTEGER DEFAULT 1,
      notif_payout_wa         INTEGER DEFAULT 1,
      notif_payout_inapp      INTEGER DEFAULT 1,
      default_shipping_method  TEXT    DEFAULT 'courier',
      default_packaging_type   TEXT    DEFAULT 'standard',
      away_dates               TEXT    DEFAULT NULL,
      festive_cutoff           TEXT    DEFAULT NULL,
      created_at        TEXT    DEFAULT (datetime('now')),
      updated_at        TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS store_workspace_photos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      photo_url   TEXT    NOT NULL,
      caption     TEXT    DEFAULT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_swp_seller ON store_workspace_photos(seller_id);

    CREATE TABLE IF NOT EXISTS payout_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      txn_ref         TEXT    NOT NULL UNIQUE,   -- e.g. TXN-10042
      amount_paise    INTEGER NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','settled','completed','failed')),
      payout_method   TEXT    NOT NULL DEFAULT 'bank_transfer',
      scheduled_at    TEXT    DEFAULT NULL,
      created_at      TEXT    DEFAULT (datetime('now')),
      updated_at      TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_payouts_seller ON payout_history(seller_id);

    CREATE TABLE IF NOT EXISTS seller_team_members (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL,
      role       TEXT    NOT NULL CHECK(role IN ('owner','admin','editor','viewer')),
      created_at TEXT    DEFAULT (datetime('now')),
      updated_at TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_stm_seller ON seller_team_members(seller_id);

    CREATE TABLE IF NOT EXISTS zai_mode_state (
      seller_id  INTEGER PRIMARY KEY REFERENCES seller_profiles(id) ON DELETE CASCADE,
      enabled    INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT    DEFAULT (datetime('now'))
    );
  `);
};
migrateStoreConfig();

// ============================================================
// PART 2: ADMIN PANEL MIGRATIONS
// ============================================================

// Task 01: Migration for admin_users table
const migrateAdminUsers = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      display_name TEXT NOT NULL DEFAULT 'Tohfa Admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
  `);

  const count = db.prepare("SELECT COUNT(*) as c FROM admin_users").get().c;
  if (count === 0) {
    db.prepare(`
      INSERT OR IGNORE INTO admin_users (username, email, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin', 'admin@tohfa.in', '$2b$12$I2jCrfCU3rZ4BvvvZnk.q.b1Ps7.A2/5bBlxQC2MigusgUdkiIPZ.', 'Tohfa Admin', 'super_admin');
  }
};
migrateAdminUsers();

// Task 02: Migration for audit_logs table
const migrateAuditLogs = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      actor_id INTEGER NOT NULL,
      actor_name TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      target_label TEXT,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
  `);
};
migrateAuditLogs();

// Task 03: DB — categories table (extend existing)
const migratePart2Categories = () => {
  const alters = [
    "ALTER TABLE categories ADD COLUMN display_name TEXT",
    "ALTER TABLE categories ADD COLUMN emoji_icon TEXT DEFAULT '🏷️'",
    "ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0",
    "ALTER TABLE categories ADD COLUMN is_active INTEGER DEFAULT 1",
    "ALTER TABLE categories ADD COLUMN product_count INTEGER DEFAULT 0",
    "ALTER TABLE categories ADD COLUMN updated_at TEXT"
  ];
  for (const sql of alters) {
    try {
      db.exec(sql);
    } catch (e) {}
  }

  // Populate data for old columns to new columns
  try {
    db.exec("UPDATE categories SET display_name = name WHERE display_name IS NULL;");
    db.exec("UPDATE categories SET emoji_icon = icon_emoji WHERE emoji_icon IS NULL OR emoji_icon = '🏷️';");
    db.exec("UPDATE categories SET product_count = item_count WHERE product_count IS NULL OR product_count = 0;");
    db.exec("UPDATE categories SET updated_at = datetime('now') WHERE updated_at IS NULL;");
  } catch (e) {}

  // Seed / Insert or update categories
  const seedCategories = [
    ['Ceramics', 'ceramics-pottery', '🏺', 1, 1, 42],
    ['Hand-Knits', 'hand-knits', '🧶', 2, 1, 12],
    ['Heirloom Jewelry', 'jewelry', '💍', 3, 0, 0],
    ['Wall Art', 'wall-art-prints', '🖼️', 4, 1, 29]
  ];

  for (const cat of seedCategories) {
    const existing = db.prepare("SELECT id FROM categories WHERE slug = ?").get(cat[1]);
    if (existing) {
      db.prepare(`
        UPDATE categories 
        SET display_name = ?, emoji_icon = ?, sort_order = ?, is_active = ?, product_count = ?, name = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(cat[0], cat[2], cat[3], cat[4], cat[5], cat[0], existing.id);
    } else {
      db.prepare(`
        INSERT INTO categories (display_name, slug, emoji_icon, sort_order, is_active, product_count, name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(cat[0], cat[1], cat[2], cat[3], cat[4], cat[5], cat[0]);
    }
  }
};
migratePart2Categories();

// Task 04: Migration for sponsored_products table
const migrateSponsoredProducts = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sponsored_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
      is_sponsored INTEGER NOT NULL DEFAULT 0,
      sponsored_at TEXT,
      sponsored_by INTEGER REFERENCES admin_users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsored_product_id ON sponsored_products(product_id);
    CREATE INDEX IF NOT EXISTS idx_sponsored_is_sponsored ON sponsored_products(is_sponsored);
  `);
};
migrateSponsoredProducts();

// Task 05: Migration for order_flags table
const migrateOrderFlags = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_flags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL UNIQUE,
      flag_type TEXT NOT NULL DEFAULT 'refund_review',
      flagged_by INTEGER NOT NULL REFERENCES admin_users(id),
      flagged_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      notes TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_order_flags_order_id ON order_flags(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_flags_flag_type ON order_flags(flag_type);
  `);
};
migrateOrderFlags();

// Task 06: Migration for payment_health_logs table
const migratePaymentHealthLogs = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_health_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_type TEXT NOT NULL DEFAULT 'auto',
      status TEXT NOT NULL,
      api_response_ms INTEGER,
      webhook_status TEXT,
      last_webhook_at TEXT,
      last_txn_id TEXT,
      last_txn_status TEXT,
      region TEXT DEFAULT 'India (South)',
      raw_payload TEXT,
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
};
migratePaymentHealthLogs();

// Task 07: Migration for seller_bans table
const migrateSellerBans = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seller_bans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      banned_by INTEGER NOT NULL REFERENCES admin_users(id),
      ban_reason TEXT NOT NULL,
      banned_at TEXT NOT NULL DEFAULT (datetime('now')),
      unbanned_at TEXT,
      unbanned_by INTEGER REFERENCES admin_users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_seller_bans_seller_id ON seller_bans(seller_id);
  `);
};
migrateSellerBans();

// Occasions Feature: Migration for occasions table
const migrateOccasions = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS occasions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      occasion_type TEXT NOT NULL DEFAULT 'other' CHECK(occasion_type IN ('birthday','anniversary','wedding','festival','just_because','other')),
      date          TEXT NOT NULL,
      reminder_days INTEGER DEFAULT 7,
      notes         TEXT DEFAULT NULL,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_occasions_user ON occasions(user_id);
    CREATE INDEX IF NOT EXISTS idx_occasions_date  ON occasions(date);
  `);
};
migrateOccasions();

// Migration for seller_order_meta table
const migrateSellerOrderMeta = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seller_order_meta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      seller_id INTEGER,
      fulfillment_status TEXT DEFAULT 'pending',
      tracking_number TEXT,
      dispatch_note TEXT,
      gift_wrap_requested INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_som_order_id ON seller_order_meta(order_id);
  `);
};
migrateSellerOrderMeta();

// Migration for order_tracking_events table
const migrateOrderTrackingEvents = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_tracking_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT,
      occurred_at TEXT DEFAULT (datetime('now')),
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ote_order ON order_tracking_events(order_id);
  `);
};
migrateOrderTrackingEvents();

// Customize Feature: Migration for conversations, templates, responses, offers, and messages
const migrateCustomize = () => {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES users(id),
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      listing_id INTEGER NOT NULL REFERENCES listings(id),
      status TEXT NOT NULL DEFAULT 'intake_in_progress',
      intake_complete INTEGER NOT NULL DEFAULT 0,
      intake_summary TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS intake_question_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_type_tag TEXT NOT NULL,
      question_text TEXT NOT NULL,
      answer_type TEXT NOT NULL CHECK(answer_type IN ('free_text','photo_upload','single_choice','number','date_picker','long_text')),
      options TEXT DEFAULT NULL,
      is_tohfa_default INTEGER NOT NULL DEFAULT 1,
      seller_id INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS intake_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES intake_question_templates(id),
      question_text TEXT NOT NULL,
      answer_type TEXT NOT NULL,
      answer_value TEXT,
      answered_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custom_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      seller_id INTEGER NOT NULL REFERENCES users(id),
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      price INTEGER NOT NULL CHECK(price > 0),
      delivery_date TEXT NOT NULL,
      seller_notes TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','expired')),
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      sender_role TEXT CHECK(sender_role IN ('buyer','seller','bot')),
      message_type TEXT CHECK(message_type IN ('text','photo','system')),
      content TEXT,
      image_url TEXT DEFAULT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      is_read INTEGER DEFAULT 0
    );
  `);

  // Handle altering conversations gracefully if it ever existed before
  try {
    db.exec("ALTER TABLE conversations ADD COLUMN intake_complete INTEGER NOT NULL DEFAULT 0;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE conversations ADD COLUMN intake_summary TEXT DEFAULT NULL;");
  } catch (e) {}

  // Seed default templates if they don't exist yet
  const defaultCount = db.prepare("SELECT COUNT(*) as count FROM intake_question_templates WHERE is_tohfa_default = 1").get().count;
  if (defaultCount === 0) {
    const insert = db.prepare(`
      INSERT INTO intake_question_templates 
      (product_type_tag, question_text, answer_type, options, is_tohfa_default, seller_id, display_order, is_active)
      VALUES (?, ?, ?, ?, 1, NULL, ?, 1)
    `);

    const seedQuestions = [
      // resin_art
      {
        product_type_tag: 'resin_art',
        question_text: 'What name or text should be engraved or included?',
        answer_type: 'free_text',
        options: null,
        display_order: 1
      },
      {
        product_type_tag: 'resin_art',
        question_text: 'Pick a colour scheme',
        answer_type: 'single_choice',
        options: JSON.stringify(["Ocean Teal","Rose Gold","Jet Black","Forest Green","Sunset Orange","Custom (describe below)"]),
        display_order: 2
      },
      {
        product_type_tag: 'resin_art',
        question_text: 'Upload a reference photo or inspiration image (optional)',
        answer_type: 'photo_upload',
        options: null,
        display_order: 3
      },
      {
        product_type_tag: 'resin_art',
        question_text: 'Would you like a lotus engraving?',
        answer_type: 'single_choice',
        options: JSON.stringify(["Yes","No"]),
        display_order: 4
      },
      {
        product_type_tag: 'resin_art',
        question_text: 'When do you need this by?',
        answer_type: 'date_picker',
        options: null,
        display_order: 5
      },
      {
        product_type_tag: 'resin_art',
        question_text: 'Any other details for the seller?',
        answer_type: 'long_text',
        options: null,
        display_order: 6
      },

      // photo_gifts
      {
        product_type_tag: 'photo_gifts',
        question_text: 'Who is this gift for?',
        answer_type: 'free_text',
        options: null,
        display_order: 1
      },
      {
        product_type_tag: 'photo_gifts',
        question_text: 'What is the occasion?',
        answer_type: 'single_choice',
        options: JSON.stringify(["Birthday","Anniversary","Wedding","Graduation","Just Because","Other"]),
        display_order: 2
      },
      {
        product_type_tag: 'photo_gifts',
        question_text: 'Upload your photo(s)',
        answer_type: 'photo_upload',
        options: null,
        display_order: 3
      },
      {
        product_type_tag: 'photo_gifts',
        question_text: 'What text or message should appear on the gift?',
        answer_type: 'free_text',
        options: null,
        display_order: 4
      },
      {
        product_type_tag: 'photo_gifts',
        question_text: 'When do you need this by?',
        answer_type: 'date_picker',
        options: null,
        display_order: 5
      },
      {
        product_type_tag: 'photo_gifts',
        question_text: 'Any other details for the seller?',
        answer_type: 'long_text',
        options: null,
        display_order: 6
      },

      // jewellery
      {
        product_type_tag: 'jewellery',
        question_text: 'What name or initials should be included?',
        answer_type: 'free_text',
        options: null,
        display_order: 1
      },
      {
        product_type_tag: 'jewellery',
        question_text: 'Select a metal/finish',
        answer_type: 'single_choice',
        options: JSON.stringify(["Gold-plated","Silver","Rose Gold","Oxidised Silver","Brass"]),
        display_order: 2
      },
      {
        product_type_tag: 'jewellery',
        question_text: 'Upload an inspiration image (optional)',
        answer_type: 'photo_upload',
        options: null,
        display_order: 3
      },
      {
        product_type_tag: 'jewellery',
        question_text: 'What size do you need? (e.g. ring size, chain length)',
        answer_type: 'free_text',
        options: null,
        display_order: 4
      },
      {
        product_type_tag: 'jewellery',
        question_text: 'When do you need this by?',
        answer_type: 'date_picker',
        options: null,
        display_order: 5
      },
      {
        product_type_tag: 'jewellery',
        question_text: 'Any other details for the seller?',
        answer_type: 'long_text',
        options: null,
        display_order: 6
      },

      // generic tags: 'frames', 'neon_signs', 'hampers', 'tote_bags'
      ...['frames', 'neon_signs', 'hampers', 'tote_bags'].flatMap(tag => [
        {
          product_type_tag: tag,
          question_text: 'What name or text should be included?',
          answer_type: 'free_text',
          options: null,
          display_order: 1
        },
        {
          product_type_tag: tag,
          question_text: 'When do you need this by?',
          answer_type: 'date_picker',
          options: null,
          display_order: 2
        },
        {
          product_type_tag: tag,
          question_text: 'Any other details for the seller?',
          answer_type: 'long_text',
          options: null,
          display_order: 3
        }
      ])
    ];

    const insertTransaction = db.transaction((questions) => {
      for (const q of questions) {
        insert.run(q.product_type_tag, q.question_text, q.answer_type, q.options, q.display_order);
      }
    });

    insertTransaction(seedQuestions);
    console.log('Successfully seeded default intake question templates.');
  }

  // Count total rows in intake_question_templates
  const totalCount = db.prepare("SELECT COUNT(*) as count FROM intake_question_templates").get().count;
  console.log(`Total rows in intake_question_templates: ${totalCount}`);
};

migrateCustomize();

try {
  db.exec("ALTER TABLE listings ADD COLUMN customization_config TEXT DEFAULT NULL;");
} catch (e) {}

try {
  db.exec("ALTER TABLE listings ADD COLUMN product_tag TEXT DEFAULT NULL;");
} catch (e) {}

module.exports = db;

