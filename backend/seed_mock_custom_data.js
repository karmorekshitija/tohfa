const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'tohfa.db');
console.log('Connecting to database at:', dbPath);
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

const BCRYPT_SALT_ROUNDS = 12;

async function seed() {
  try {
    db.prepare('BEGIN TRANSACTION').run();

    console.log('Hashing passwords...');
    const passwordHash = await bcrypt.hash('password123', BCRYPT_SALT_ROUNDS);
    console.log('Passwords hashed.');

    const mockSellers = [
      {
        email: 'sophia@test.com',
        full_name: 'Sophia Craft',
        shop_name: 'Bespoke Gifts Boutique',
        bio: 'Creating personalized hand-carved wood products and custom name embroidery',
        ships_in_days: 3,
        instagram_handle: '@bespoke_gifts',
        location: 'Udaipur',
        avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'
      },
      {
        email: 'aria@test.com',
        full_name: 'Aria Loom',
        shop_name: 'Loom & Thread',
        bio: 'Weaving hand-spun textures and wool throws since 2018',
        ships_in_days: 5,
        instagram_handle: '@loom_thread',
        location: 'Jaipur',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
      },
      {
        email: 'marcus@test.com',
        full_name: 'Marcus Flame',
        shop_name: 'Aura Candles',
        bio: 'Soy wax candles hand-poured with native botanicals and organic essential oils',
        ships_in_days: 2,
        instagram_handle: '@aura_candles',
        location: 'Mussoorie',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
      }
    ];

    const sellerIds = {};

    for (const seller of mockSellers) {
      // 1. Check if user exists
      let user = db.prepare('SELECT id FROM users WHERE email = ?').get(seller.email);
      let userId;
      if (!user) {
        const res = db.prepare(`
          INSERT INTO users (email, password_hash, full_name, role, avatar_url, location, is_active, is_banned)
          VALUES (?, ?, ?, 'seller', ?, ?, 1, 0)
        `).run(seller.email, passwordHash, seller.full_name, seller.avatar_url, seller.location);
        userId = res.lastInsertRowid;
        console.log(`Created user ${seller.email} with ID: ${userId}`);
      } else {
        userId = user.id;
        console.log(`User ${seller.email} already exists with ID: ${userId}`);
      }
      sellerIds[seller.email] = userId;

      // 2. Check if seller_profile exists
      let profile = db.prepare('SELECT id FROM seller_profiles WHERE user_id = ?').get(userId);
      if (!profile) {
        db.prepare(`
          INSERT INTO seller_profiles (user_id, shop_name, shop_bio, ships_in_days, instagram_handle, is_approved, display_name, handle, store_slug)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
        `).run(
          userId,
          seller.shop_name,
          seller.bio,
          seller.ships_in_days,
          seller.instagram_handle,
          seller.shop_name,
          seller.instagram_handle.replace('@', ''),
          seller.shop_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        );
        console.log(`Created seller profile for ${seller.shop_name}`);
      } else {
        db.prepare(`
          UPDATE seller_profiles 
          SET is_approved = 1, shop_name = ?, shop_bio = ?, ships_in_days = ?, instagram_handle = ?
          WHERE user_id = ?
        `).run(seller.shop_name, seller.bio, seller.ships_in_days, seller.instagram_handle, userId);
        console.log(`Updated seller profile for ${seller.shop_name}`);
      }

      // 3. Check if store_config exists
      let config = db.prepare('SELECT seller_id FROM store_config WHERE seller_id = ?').get(userId);
      if (!config) {
        db.prepare(`
          INSERT INTO store_config (seller_id, accept_orders, vacation_mode, estimated_dispatch_sla_days, city, artist_bio, about_headline, artisan_story, current_balance_paise)
          VALUES (?, 1, 0, ?, ?, ?, ?, ?, 0)
        `).run(
          userId,
          seller.ships_in_days,
          seller.location,
          seller.bio,
          'Our Handcrafting Story',
          'We believe in slow-crafted, unique creations that hold personal value and stories.'
        );
        console.log(`Created store config for ${seller.shop_name}`);
      }
    }

    // Now seed mock products in products table
    const mockProducts = [
      {
        seller_email: 'sophia@test.com',
        category_id: 7, // Customized Gifts
        name: 'Custom Family Watercolor Portrait',
        description: 'A beautiful custom hand-painted watercolor portrait of your family or loved ones. Perfect for anniversaries, birthdays, or housewarming gifts. Completely customized based on your photos and instructions.',
        price_paise: 350000,
        stock_qty: 25,
        ships_in_days: 7,
        imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600'
      },
      {
        seller_email: 'sophia@test.com',
        category_id: 7, // Customized Gifts
        name: 'Bespoke Engraved Wooden Ring Box',
        description: 'A rustic hand-carved oak ring box with your initials and wedding date engraved on the lid. Features a soft moss or velvet lining to protect your rings.',
        price_paise: 125000,
        stock_qty: 15,
        ships_in_days: 4,
        imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600'
      },
      {
        seller_email: 'sophia@test.com',
        category_id: 7, // Customized Gifts
        name: 'Personalized Leather Journal with Initials',
        description: 'Hand-bound genuine full-grain leather notebook with your initials stamped on the cover. Contains 120 sheets of recycled cotton paper.',
        price_paise: 185000,
        stock_qty: 30,
        ships_in_days: 3,
        imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600'
      },
      {
        seller_email: 'sophia@test.com',
        category_id: 7, // Customized Gifts
        name: 'Custom Name Embroidered Cushion Cover',
        description: 'Beautiful linen cushion cover featuring intricate hand-embroidered floral patterns and a custom name of your choice in elegant cursive.',
        price_paise: 95000,
        stock_qty: 20,
        ships_in_days: 5,
        imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e6?w=600'
      },
      {
        seller_email: 'aria@test.com',
        category_id: 1, // Textile Arts
        name: 'Earthy Merino Wool Blanket Throw',
        description: 'A luxurious, thick woven organic merino wool throw blanket in warm earth tones. Draped over a bed or couch, it provides cozy warmth and tactile texture.',
        price_paise: 420000,
        stock_qty: 8,
        ships_in_days: 5,
        imageUrl: 'https://images.unsplash.com/photo-1580301762395-21ce84d00bc6?w=600'
      },
      {
        seller_email: 'marcus@test.com',
        category_id: 5, // Candles & Fragrance
        name: 'Wild Lavender & Sage Soy Candle',
        description: 'A hand-poured soy wax candle in an amber glass jar, scented with organic French lavender and garden sage essential oils. Clean-burning with a cotton wick.',
        price_paise: 65000,
        stock_qty: 50,
        ships_in_days: 2,
        imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600'
      },
      {
        seller_email: 'sophia@test.com',
        category_id: 3, // Ceramics
        name: 'Hand-thrown Speckled Ceramic Teacup Set',
        description: 'A set of two hand-thrown stoneware teacups with a speckled white and ochre glaze. Beautifully tactile, lightweight, and dishwasher safe.',
        price_paise: 160000,
        stock_qty: 12,
        ships_in_days: 3,
        imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600'
      }
    ];

    for (const prod of mockProducts) {
      const sellerId = sellerIds[prod.seller_email];
      
      // Check if product exists
      let existing = db.prepare('SELECT id FROM products WHERE name = ? AND seller_id = ?').get(prod.name, sellerId);
      let productId;
      
      if (!existing) {
        const res = db.prepare(`
          INSERT INTO products (seller_id, category_id, name, description, price_paise, stock_qty, ships_in_days, status, avg_rating, review_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 4.8, 3)
        `).run(sellerId, prod.category_id, prod.name, prod.description, prod.price_paise, prod.stock_qty, prod.ships_in_days);
        
        productId = res.lastInsertRowid;
        console.log(`Created product "${prod.name}" with ID: ${productId}`);

        // Insert primary image
        db.prepare(`
          INSERT INTO product_images (product_id, url, is_primary, sort_order)
          VALUES (?, ?, 1, 0)
        `).run(productId, prod.imageUrl);
      } else {
        productId = existing.id;
        console.log(`Product "${prod.name}" already exists with ID: ${productId}`);
      }
    }

    // Now seed custom listings in listings table (for customization tab)
    const mockCustomListings = [
      {
        seller_email: 'sophia@test.com',
        title: 'Bespoke Hand-Carved Wooden Name Sign',
        category: 'Customized Gifts',
        description: 'A solid wood sign custom-carved with your family name or house name. Hand-sanded and finished with outdoor-grade varnish. Includes mounting hardware.',
        base_price: 280000,
        ships_in_days: 10,
        cover_photo_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600'
      },
      {
        seller_email: 'sophia@test.com',
        title: 'Custom Pet Portrait Illustration',
        category: 'Customized Gifts',
        description: 'Send us a photo of your pet, and we will create a high-quality hand-painted digital or watercolor illustration. Comes framed and ready to hang.',
        base_price: 320000,
        ships_in_days: 8,
        cover_photo_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600'
      },
      {
        seller_email: 'sophia@test.com',
        title: 'Custom Monogrammed Leather Coaster Set',
        category: 'Customized Gifts',
        description: 'Set of 4 full-grain leather coasters hot-stamped with your initials. Comes in a matching leather strap holder.',
        base_price: 150000,
        ships_in_days: 3,
        cover_photo_url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600'
      }
    ];

    for (const listing of mockCustomListings) {
      const sellerId = sellerIds[listing.seller_email];
      
      let existing = db.prepare('SELECT id FROM listings WHERE title = ? AND seller_id = ?').get(listing.title, sellerId);
      let listingId;
      
      if (!existing) {
        const res = db.prepare(`
          INSERT INTO listings (seller_id, title, primary_name, description, base_price, price_paise, listing_type, status, ships_in_days, cover_photo_url, category)
          VALUES (?, ?, ?, ?, ?, ?, 'custom', 'active', ?, ?, ?)
        `).run(
          sellerId,
          listing.title,
          listing.title,
          listing.description,
          listing.base_price,
          listing.base_price,
          listing.ships_in_days,
          listing.cover_photo_url,
          listing.category
        );
        
        listingId = res.lastInsertRowid;
        console.log(`Created custom listing "${listing.title}" with ID: ${listingId}`);

        // Insert into listing_photos and listing_images
        db.prepare(`
          INSERT INTO listing_photos (listing_id, url, is_cover, sort_order)
          VALUES (?, ?, 1, 0)
        `).run(listingId, listing.cover_photo_url);

        db.prepare(`
          INSERT INTO listing_images (listing_id, image_url, is_cover, sort_order)
          VALUES (?, ?, 1, 0)
        `).run(listingId, listing.cover_photo_url);
      } else {
        listingId = existing.id;
        console.log(`Custom listing "${listing.title}" already exists with ID: ${listingId}`);
      }
    }

    db.prepare('COMMIT').run();
    console.log('SUCCESS: Mock data and customized gifts seeded successfully!');
  } catch (err) {
    db.prepare('ROLLBACK').run();
    console.error('ERROR seeding database:', err);
  }
}

seed();
