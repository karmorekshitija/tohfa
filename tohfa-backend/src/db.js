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

// Task 06: Migration for orders table
const migrateOrders = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      order_ref           TEXT NOT NULL UNIQUE,
      buyer_id            INTEGER NOT NULL REFERENCES users(id),
      address_id          INTEGER REFERENCES addresses(id),
      status              TEXT DEFAULT 'Awaiting Payment',
      subtotal_paise      INTEGER NOT NULL,
      shipping_paise      INTEGER DEFAULT 0,
      total_paise         INTEGER NOT NULL,
      razorpay_order_id   TEXT,
      razorpay_payment_id TEXT,
      tracking_number     TEXT,
      cancel_reason       TEXT,
      cancelled_at        DATETIME,
      shipped_at          DATETIME,
      delivered_at        DATETIME,
      created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_ref ON orders(order_ref);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  `);
};

migrateOrders();

// Task 07: Migration for order_items table
const migrateOrderItems = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id       INTEGER NOT NULL REFERENCES products(id),
      product_name     TEXT NOT NULL,
      unit_price_paise INTEGER NOT NULL,
      quantity         INTEGER NOT NULL DEFAULT 1,
      image_url        TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  `);
};

migrateOrderItems();

// Task 08: Migration for reviews table
const migrateReviews = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  INTEGER NOT NULL REFERENCES products(id),
      reviewer_id INTEGER NOT NULL REFERENCES users(id),
      order_id    INTEGER REFERENCES orders(id),
      rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      body        TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(reviewer_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
  `);
};

migrateReviews();

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

// Task 10: Migration for reels table
const migrateReels = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reels (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id       INTEGER NOT NULL REFERENCES users(id),
      product_id      INTEGER REFERENCES products(id),
      caption         TEXT,
      video_url       TEXT NOT NULL,
      thumbnail_url   TEXT,
      duration_secs   INTEGER,
      like_count      INTEGER DEFAULT 0,
      comment_count   INTEGER DEFAULT 0,
      save_count      INTEGER DEFAULT 0,
      status          TEXT DEFAULT 'active',
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reels_seller ON reels(seller_id);
    CREATE INDEX IF NOT EXISTS idx_reels_created ON reels(created_at DESC);
  `);
};

migrateReels();

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

// Part4 Task 01: Extend seller_profiles with Seller Studio columns
// (existing table has shop_name, shop_bio, etc. from Part 3 — we ADD new columns)
const migratePart4SellerProfiles = () => {
  const newCols = [
    "ALTER TABLE seller_profiles ADD COLUMN display_name TEXT",
    "ALTER TABLE seller_profiles ADD COLUMN handle TEXT",
    "ALTER TABLE seller_profiles ADD COLUMN bio TEXT",
    "ALTER TABLE seller_profiles ADD COLUMN location TEXT",
    "ALTER TABLE seller_profiles ADD COLUMN website TEXT",
    "ALTER TABLE seller_profiles ADD COLUMN artisan_story TEXT",
    "ALTER TABLE seller_profiles ADD COLUMN avatar_url TEXT",
    "ALTER TABLE seller_profiles ADD COLUMN store_slug TEXT",
    "ALTER TABLE seller_profiles ADD COLUMN platform_fee_pct INTEGER DEFAULT 8",
    "ALTER TABLE seller_profiles ADD COLUMN is_accepting_orders INTEGER DEFAULT 1",
    "ALTER TABLE seller_profiles ADD COLUMN zai_mode_enabled INTEGER DEFAULT 0",
    "ALTER TABLE seller_profiles ADD COLUMN default_language TEXT DEFAULT 'en'",
    "ALTER TABLE seller_profiles ADD COLUMN store_currency TEXT DEFAULT 'INR'",
    "ALTER TABLE seller_profiles ADD COLUMN onboarding_step INTEGER DEFAULT 0",
    "ALTER TABLE seller_profiles ADD COLUMN seller_rank TEXT",
    "ALTER TABLE seller_profiles ADD COLUMN total_reviews INTEGER DEFAULT 0",
    "ALTER TABLE seller_profiles ADD COLUMN avg_rating REAL DEFAULT 0.0",
    "ALTER TABLE seller_profiles ADD COLUMN total_sales INTEGER DEFAULT 0",
  ];
  for (const sql of newCols) {
    try { db.exec(sql); } catch (e) {}
  }
  // Add unique indexes (ignore if already exist)
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sp4_handle ON seller_profiles(handle) WHERE handle IS NOT NULL;"); } catch (e) {}
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sp4_store_slug ON seller_profiles(store_slug) WHERE store_slug IS NOT NULL;"); } catch (e) {}
};
migratePart4SellerProfiles();

// Part4 Task 02: listings table
const migrateListings = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id             INTEGER NOT NULL,
      title                 TEXT NOT NULL,
      primary_name          TEXT,
      description           TEXT,
      category              TEXT,
      primary_medium        TEXT,
      tags                  TEXT,
      badges                TEXT,
      price_paise           INTEGER NOT NULL,
      sku                   TEXT,
      stock_count           INTEGER DEFAULT 0,
      processing_time       TEXT,
      gift_wrap_available   INTEGER DEFAULT 0,
      gift_wrap_price_paise INTEGER DEFAULT 5000,
      handwritten_note      INTEGER DEFAULT 0,
      status                TEXT DEFAULT 'draft',
      cover_photo_url       TEXT,
      view_count            INTEGER DEFAULT 0,
      sale_count            INTEGER DEFAULT 0,
      listing_score         INTEGER DEFAULT 0,
      weight_grams          REAL,
      length_cm             REAL,
      width_cm              REAL,
      height_cm             REAL,
      shipping_profile_id   INTEGER,
      published_at          TEXT,
      created_at            TEXT DEFAULT (datetime('now')),
      updated_at            TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON listings(seller_id);
    CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
    CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
    CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at);
  `);
};
migrateListings();

// Part4 Task 03: listing_photos table
const migrateListingPhotos = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listing_photos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id  INTEGER NOT NULL,
      url         TEXT NOT NULL,
      is_cover    INTEGER DEFAULT 0,
      is_video    INTEGER DEFAULT 0,
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_listing_photos_listing_id ON listing_photos(listing_id);
  `);
};
migrateListingPhotos();

// Part4 Task 04: listing_shipping_profiles table
const migrateListingShippingProfiles = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listing_shipping_profiles (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id            INTEGER NOT NULL,
      profile_name         TEXT NOT NULL,
      is_domestic          INTEGER DEFAULT 1,
      is_international     INTEGER DEFAULT 0,
      includes_wrap        INTEGER DEFAULT 0,
      auto_customs_docs    INTEGER DEFAULT 0,
      flat_fee_paise       INTEGER DEFAULT 0,
      estimated_days_min   INTEGER,
      estimated_days_max   INTEGER,
      origin_address       TEXT,
      created_at           TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_shipping_profiles_seller_id ON listing_shipping_profiles(seller_id);
  `);
};
migrateListingShippingProfiles();

// Part4 Task 05: seller_reels table
const migrateSellerReels = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seller_reels (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id            INTEGER NOT NULL,
      video_url            TEXT NOT NULL,
      thumbnail_url        TEXT,
      caption              TEXT,
      tags                 TEXT,
      audio_type           TEXT DEFAULT 'original',
      share_to_feed        INTEGER DEFAULT 1,
      share_to_profile     INTEGER DEFAULT 1,
      auto_post_instagram  INTEGER DEFAULT 0,
      status               TEXT DEFAULT 'published',
      scheduled_at         TEXT,
      view_count           INTEGER DEFAULT 0,
      like_count           INTEGER DEFAULT 0,
      created_at           TEXT DEFAULT (datetime('now')),
      updated_at           TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_seller_reels_seller_id ON seller_reels(seller_id);
    CREATE INDEX IF NOT EXISTS idx_seller_reels_status ON seller_reels(status);
  `);
};
migrateSellerReels();

// Part4 Task 06: reel_product_tags table
const migrateReelProductTags = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reel_product_tags (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      reel_id    INTEGER NOT NULL,
      listing_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(reel_id, listing_id),
      FOREIGN KEY (reel_id) REFERENCES seller_reels(id) ON DELETE CASCADE,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_reel_product_tags_reel_id ON reel_product_tags(reel_id);
  `);
};
migrateReelProductTags();

// Part4 Task 07: seller_order_meta table
const migrateSellerOrderMeta = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seller_order_meta (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id            INTEGER NOT NULL UNIQUE,
      seller_id           INTEGER NOT NULL,
      fulfillment_status  TEXT DEFAULT 'pending',
      tracking_number     TEXT,
      tracking_prefix     TEXT,
      dispatch_note       TEXT,
      gift_wrap_requested INTEGER DEFAULT 0,
      dispatched_at       TEXT,
      estimated_delivery  TEXT,
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_seller_order_meta_seller_id ON seller_order_meta(seller_id);
    CREATE INDEX IF NOT EXISTS idx_seller_order_meta_status ON seller_order_meta(fulfillment_status);
  `);
};
migrateSellerOrderMeta();

// Part4 Task 08: order_tracking_events table
const migrateOrderTrackingEvents = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_tracking_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL,
      seller_id   INTEGER NOT NULL,
      status      TEXT NOT NULL,
      note        TEXT,
      occurred_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tracking_events_order_id ON order_tracking_events(order_id);
  `);
};
migrateOrderTrackingEvents();

// Part4 Task 09: review_replies table
const migrateReviewReplies = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_replies (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id   INTEGER NOT NULL UNIQUE,
      seller_id   INTEGER NOT NULL,
      reply_text  TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_review_replies_review_id ON review_replies(review_id);
    CREATE INDEX IF NOT EXISTS idx_review_replies_seller_id ON review_replies(seller_id);
  `);
};
migrateReviewReplies();

// Part4 Task 10: seller_announcements table + seed 3 announcements
const migrateSellerAnnouncements = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seller_announcements (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL,
      icon        TEXT DEFAULT 'local_florist',
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);
  const count = db.prepare("SELECT COUNT(*) as c FROM seller_announcements").get().c;
  if (count === 0) {
    const ins = db.prepare("INSERT INTO seller_announcements (title, body, icon) VALUES (?, ?, ?)");
    ins.run('New Packaging Guidelines', 'Effective Nov 1: all botanical prints must ship in acid-free tissue. Download the updated packaging guide below.', 'local_florist');
    ins.run('Festive Season Boost 🎄', 'Enable Gift Wrap to reach 3× more buyers this season. Sellers with gift wrap earn 28% more in Q4.', 'card_giftcard');
    ins.run('ZAI Mode Now Available', 'Try ZAI Mode for AI-powered inventory tips, trend insights, and pricing nudges personalised for your store.', 'auto_awesome');
  }
};
migrateSellerAnnouncements();

// Part4 Task 11: seller_team_members table
const migrateSellerTeamMembers = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seller_team_members (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id   INTEGER NOT NULL,
      email       TEXT NOT NULL,
      role        TEXT DEFAULT 'catalog',
      name        TEXT,
      invited_at  TEXT DEFAULT (datetime('now')),
      accepted_at TEXT,
      UNIQUE(seller_id, email),
      FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_team_members_seller_id ON seller_team_members(seller_id);
  `);
};
migrateSellerTeamMembers();

// Part4 Task 12: payout_history table
const migratePayoutHistory = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payout_history (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id        INTEGER NOT NULL,
      txn_ref          TEXT NOT NULL,
      amount_paise     INTEGER NOT NULL,
      status           TEXT DEFAULT 'pending',
      payout_method    TEXT,
      scheduled_at     TEXT,
      settled_at       TEXT,
      created_at       TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_payout_history_seller_id ON payout_history(seller_id);
  `);
};
migratePayoutHistory();

// Part4 Task 13: zai_mode_state table
const migrateZaiModeState = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS zai_mode_state (
      seller_id     INTEGER PRIMARY KEY,
      enabled       INTEGER DEFAULT 0,
      updated_at    TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE
    );
  `);
};
migrateZaiModeState();

// Part4 Task 14: listing_drafts table
const migrateListingDrafts = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listing_drafts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id     INTEGER NOT NULL,
      draft_data    TEXT NOT NULL,
      current_step  INTEGER DEFAULT 1,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_listing_drafts_seller_id ON listing_drafts(seller_id);
  `);
};
migrateListingDrafts();

// Part4 Task 15: seller_messages table
const migrateSellerMessages = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seller_messages (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id    INTEGER NOT NULL,
      buyer_id     INTEGER NOT NULL,
      order_id     INTEGER,
      sender_role  TEXT NOT NULL,
      message_text TEXT NOT NULL,
      is_read      INTEGER DEFAULT 0,
      sent_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_seller_messages_seller_id ON seller_messages(seller_id);
    CREATE INDEX IF NOT EXISTS idx_seller_messages_buyer_id ON seller_messages(buyer_id);
  `);
};
migrateSellerMessages();

module.exports = db;

