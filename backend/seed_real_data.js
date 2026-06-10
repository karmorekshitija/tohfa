const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'tohfa.db');
console.log('Connecting to database at:', dbPath);
const db = new Database(dbPath);

// Disable foreign keys during seeding to prevent constraint failures
db.pragma('foreign_keys = OFF');

const BCRYPT_SALT_ROUNDS = 12;

async function seed() {
  try {
    console.log('Starting transaction...');
    db.prepare('BEGIN TRANSACTION').run();

    console.log('Hashing password for mock accounts...');
    const passwordHash = await bcrypt.hash('password123', BCRYPT_SALT_ROUNDS);

    // 1. Seed Sellers
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
      },
      {
        email: 'kshitija@test.com',
        full_name: 'Kshitija Pottery',
        shop_name: 'Stoneware Studio',
        bio: 'Creating beautiful hand-thrown stoneware ceramics and hand-built clay artifacts',
        ships_in_days: 3,
        instagram_handle: '@stoneware_studio',
        location: 'Jaipur',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
      }
    ];

    const sellerIds = {};

    for (const seller of mockSellers) {
      let user = db.prepare('SELECT id FROM users WHERE email = ?').get(seller.email);
      let userId;
      if (!user) {
        const res = db.prepare(`
          INSERT INTO users (email, password_hash, full_name, role, avatar_url, location, is_active, is_banned)
          VALUES (?, ?, ?, 'seller', ?, ?, 1, 0)
        `).run(seller.email, passwordHash, seller.full_name, seller.avatar_url, seller.location);
        userId = res.lastInsertRowid;
        console.log(`Created seller user ${seller.email} with ID: ${userId}`);
      } else {
        userId = user.id;
        db.prepare("UPDATE users SET role = 'seller', is_active = 1, is_banned = 0 WHERE id = ?").run(userId);
        console.log(`Seller user ${seller.email} already exists with ID: ${userId}`);
      }
      sellerIds[seller.email] = userId;

      // Seller Profile
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

      // Store Config
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

    // 2. Clear old mock products to prevent duplicates (optional but helps keep it clean)
    // We keep existing non-conflicting ones and delete ones we seed
    const productsToSeed = [
      {
        seller_email: 'aria@test.com',
        category_id: 1, // Textile Arts
        name: 'Earthy Merino Wool Blanket Throw',
        description: 'A luxurious, thick woven organic merino wool throw blanket in warm earth tones. Draped over a bed or couch, it provides cozy warmth and tactile texture. Carefully spun on hand looms.',
        price_paise: 420000,
        stock_qty: 8,
        ships_in_days: 5,
        imageUrl: '/uploads/listings/Crochet_blanket_on_wood_chair_202606071048.jpeg'
      },
      {
        seller_email: 'aria@test.com',
        category_id: 1, // Textile Arts
        name: 'Cozy Crochet Heart Coasters Set',
        description: 'Set of 4 hand-crocheted cotton heart coasters in soft cream and mauve. Adds a lovely, warm artisanal touch to your dining table or tea setting.',
        price_paise: 75000,
        stock_qty: 20,
        ships_in_days: 3,
        imageUrl: '/uploads/listings/Crochet_heart_coasters_on_runner_202606071048.jpeg'
      },
      {
        seller_email: 'aria@test.com',
        category_id: 1, // Textile Arts
        name: 'Handmade Crochet Amigurumi Heart',
        description: 'A cute hand-crocheted heart plushie made with soft organic cotton yarn. Perfect for gifting, room decor, or desk ornament.',
        price_paise: 45000,
        stock_qty: 15,
        ships_in_days: 2,
        imageUrl: '/uploads/listings/Crochet_amigurumi_heart_plushie_202606071048.jpeg'
      },
      {
        seller_email: 'aria@test.com',
        category_id: 1, // Textile Arts
        name: 'Artisanal Crochet Heart Tote Bag',
        description: 'Spacious hand-knitted cotton tote bag featuring a cute heart motif. Sturdy straps and organic linen lining. Perfect for daily errands and weekend markets.',
        price_paise: 185000,
        stock_qty: 10,
        ships_in_days: 4,
        imageUrl: '/uploads/listings/Crochet_tote_bag_with_heart_202606071048.jpeg'
      },
      {
        seller_email: 'marcus@test.com',
        category_id: 5, // Candles & Fragrance
        name: 'Hand-painted Clay Festive Diyas',
        description: 'Set of 6 traditional clay diyas, beautifully hand-painted with gold highlights. Made with organic terracotta clay and perfect for warm festive lights.',
        price_paise: 69000,
        stock_qty: 40,
        ships_in_days: 2,
        imageUrl: '/uploads/listings/Hand-painted_clay_diyas_with_gol._202606071048.jpeg'
      },
      {
        seller_email: 'marcus@test.com',
        category_id: 5, // Candles & Fragrance
        name: 'Wild Lavender & Sage Soy Candle',
        description: 'A hand-poured soy wax candle in an amber glass jar, scented with organic French lavender and garden sage essential oils. Clean-burning cotton wick.',
        price_paise: 95000,
        stock_qty: 30,
        ships_in_days: 2,
        imageUrl: '/uploads/listings/ceramic_vase_lavender.jpeg'
      },
      {
        seller_email: 'sophia@test.com',
        category_id: 7, // Customized Gifts
        name: 'Monogrammed Organic Linen Robes',
        description: 'Ultra-soft premium organic linen robe with custom monogram embroidery. Made to order for a perfect personal touch.',
        price_paise: 380000,
        stock_qty: 12,
        ships_in_days: 6,
        imageUrl: '/uploads/listings/Linen_robes_with_embroidered_mon._202606071048.jpeg'
      },
      {
        seller_email: 'sophia@test.com',
        category_id: 7, // Customized Gifts
        name: 'Embroidered Silk Name Sleep Mask',
        description: 'A luxurious pure mulberry silk sleep mask, custom-embroidered with your name in elegant script. Promotes deep, peaceful rest.',
        price_paise: 120000,
        stock_qty: 25,
        ships_in_days: 4,
        imageUrl: '/uploads/listings/Silk_sleep_mask_embroidered_name_202606071048.jpeg'
      },
      {
        seller_email: 'sophia@test.com',
        category_id: 7, // Customized Gifts
        name: 'Personalized Leather Luggage Tag Set',
        description: 'Set of two genuine full-grain leather luggage tags, hand-stamped with your initials. Comes with a secure metal buckle strap.',
        price_paise: 150000,
        stock_qty: 35,
        ships_in_days: 3,
        imageUrl: '/uploads/listings/Leather_luggage_tags_handmade_gift_202606071048.jpeg'
      },
      {
        seller_email: 'sophia@test.com',
        category_id: 7, // Customized Gifts
        name: 'Lilac Leather Luggage Tags',
        description: 'Handcrafted lilac full-grain leather tags with name window and hot-stamped initials. Classy accessory for seasoned travelers.',
        price_paise: 145000,
        stock_qty: 18,
        ships_in_days: 3,
        imageUrl: '/uploads/listings/Lilac_leather_luggage_tags_tied_202606071048.jpeg'
      },
      {
        seller_email: 'kshitija@test.com',
        category_id: 3, // Ceramics
        name: 'Ceramic Vase with Lavender Design',
        description: 'A hand-thrown stoneware ceramic vase decorated with delicate hand-painted lavender designs. Perfect for dry or fresh floral arrangements.',
        price_paise: 240000,
        stock_qty: 10,
        ships_in_days: 3,
        imageUrl: '/uploads/listings/Ceramic_vase_with_lavender_motif_202606071048.jpeg'
      },
      {
        seller_email: 'kshitija@test.com',
        category_id: 3, // Ceramics
        name: 'Hand-thrown Stoneware Coffee Mugs',
        description: 'Set of two matching stoneware coffee mugs finished in a speckled white and ochre glaze. Beautifully tactile, lightweight, and dishwasher safe.',
        price_paise: 160000,
        stock_qty: 15,
        ships_in_days: 3,
        imageUrl: '/uploads/listings/Pair_of_ceramic_mugs_202606071048.jpeg'
      },
      {
        seller_email: 'kshitija@test.com',
        category_id: 3, // Ceramics
        name: 'Ceramic Coasters with Lavender Glaze',
        description: 'Set of 4 clay coasters decorated with hand-painted lavender branches. Finished with a waterproof, heat-resistant clear glaze.',
        price_paise: 110000,
        stock_qty: 20,
        ships_in_days: 3,
        imageUrl: '/uploads/listings/Ceramic_coasters_with_lavender_h._202606071048.jpeg'
      },
      {
        seller_email: 'kshitija@test.com',
        category_id: 3, // Ceramics
        name: 'Ceramic Heart Pattern Jewelry Tray',
        description: 'A delicate hand-built ceramic dish featuring a subtle heart motif glaze. Ideal for holding rings, necklaces, or small trinkets on your vanity.',
        price_paise: 89000,
        stock_qty: 22,
        ships_in_days: 2,
        imageUrl: '/uploads/listings/Ceramic_artifact_with_heart_patt._202606071048.jpeg'
      },
      {
        seller_email: 'sophia@test.com',
        category_id: 2, // Jewellery
        name: 'Ornate Amethyst Heart Necklace',
        description: 'An ornate sterling silver pendant featuring a beautifully polished heart-shaped amethyst gemstone. Handcrafted with intricate details and a thin silver chain.',
        price_paise: 350000,
        stock_qty: 5,
        ships_in_days: 4,
        imageUrl: '/uploads/listings/Amethyst_heart_necklace_ornate_s._202606071048.jpeg'
      },
      {
        seller_email: 'sophia@test.com',
        category_id: 2, // Jewellery
        name: 'Handmade Rings with Natural Gemstones',
        description: 'Sterling silver band rings set with tiny natural raw gemstones (amethyst, jade, citrine). Perfect for stacking or wearing alone.',
        price_paise: 180000,
        stock_qty: 14,
        ships_in_days: 3,
        imageUrl: '/uploads/listings/Handmade_rings_with_gemstones_202606071048.jpeg'
      },
      {
        seller_email: 'sophia@test.com',
        category_id: 4, // Journals & Stationery
        name: 'Hand-bound Literature Project Journal',
        description: 'A beautifully hand-bound literature journal featuring thick deckled-edge paper and a rustic brown leather cover. Ideal for sketchers, writers, and artists.',
        price_paise: 135000,
        stock_qty: 12,
        ships_in_days: 3,
        imageUrl: '/uploads/listings/Literature_project_journal_with_._202606071048.jpeg'
      }
    ];

    const seededProductIds = {};
    const seededListings = [];

    for (const p of productsToSeed) {
      const sellerId = sellerIds[p.seller_email];
      
      // Delete if already exists to ensure fresh copy
      db.prepare('DELETE FROM products WHERE name = ? AND seller_id = ?').run(p.name, sellerId);
      
      const res = db.prepare(`
        INSERT INTO products (seller_id, category_id, name, description, price_paise, stock_qty, ships_in_days, status, avg_rating, review_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 4.7, 5)
      `).run(sellerId, p.category_id, p.name, p.description, p.price_paise, p.stock_qty, p.ships_in_days);
      
      const productId = res.lastInsertRowid;
      seededProductIds[p.name] = productId;
      console.log(`Seeded product: "${p.name}" (ID: ${productId})`);

      // Insert image
      db.prepare(`
        INSERT INTO product_images (product_id, url, is_primary, sort_order)
        VALUES (?, ?, 1, 0)
      `).run(productId, p.imageUrl);

      // Seed corresponding listing for the seller portal catalog and order placement
      db.prepare('DELETE FROM listings WHERE title = ? AND seller_id = ?').run(p.name, sellerId);
      const listRes = db.prepare(`
        INSERT INTO listings (seller_id, title, primary_name, description, base_price, price_paise, listing_type, status, ships_in_days, cover_photo_url, category, stock_count, view_count, sale_count)
        VALUES (?, ?, ?, ?, ?, ?, 'pre-made', 'active', ?, ?, ?, ?, ?, ?)
      `).run(
        sellerId,
        p.name,
        p.name,
        p.description,
        p.price_paise,
        p.price_paise,
        p.ships_in_days,
        p.imageUrl,
        'Home Decor', // category string
        p.stock_qty,
        Math.floor(Math.random() * 200) + 100, // random view_count for analytics
        Math.floor(Math.random() * 10) + 5    // random sale_count for analytics
      );
      
      const listingId = listRes.lastInsertRowid;
      seededListings.push({
        id: listingId,
        title: p.name,
        price_paise: p.price_paise,
        seller_id: sellerId,
        ships_in_days: p.ships_in_days,
        cover_photo_url: p.imageUrl
      });

      // Insert listing photos
      db.prepare(`INSERT INTO listing_photos (listing_id, url, is_cover, sort_order) VALUES (?, ?, 1, 0)`).run(listingId, p.imageUrl);
      db.prepare(`INSERT INTO listing_images (listing_id, image_url, is_cover, sort_order) VALUES (?, ?, 1, 0)`).run(listingId, p.imageUrl);
    }

    // 3. Seed Customization Options (listings.listing_type = 'custom')
    const customListingsToSeed = [
      {
        seller_email: 'sophia@test.com',
        title: 'Bespoke Hand-Carved Wooden Name Sign',
        category: 'Customized Gifts',
        description: 'A solid wood sign custom-carved with your family name or house name. Hand-sanded and finished with outdoor-grade varnish. Includes mounting hardware.',
        base_price: 280000,
        ships_in_days: 10,
        cover_photo_url: '/uploads/listings/Leather_luggage_tags_handmade_gift_202606071048.jpeg'
      },
      {
        seller_email: 'sophia@test.com',
        title: 'Custom Pet Portrait Illustration',
        category: 'Customized Gifts',
        description: 'Send us a photo of your pet, and we will create a high-quality hand-painted digital or watercolor illustration. Comes framed and ready to hang.',
        base_price: 320000,
        ships_in_days: 8,
        cover_photo_url: '/uploads/listings/Amethyst_heart_necklace_ornate_s._202606071048.jpeg'
      },
      {
        seller_email: 'sophia@test.com',
        title: 'Custom Monogrammed Leather Coaster Set',
        category: 'Customized Gifts',
        description: 'Set of 4 full-grain leather coasters hot-stamped with your initials. Comes in a matching leather strap holder.',
        base_price: 150000,
        ships_in_days: 3,
        cover_photo_url: '/uploads/listings/Lilac_leather_luggage_tags_tied_202606071048.jpeg'
      }
    ];

    for (const listing of customListingsToSeed) {
      const sellerId = sellerIds[listing.seller_email];
      db.prepare('DELETE FROM listings WHERE title = ? AND seller_id = ?').run(listing.title, sellerId);
      
      const res = db.prepare(`
        INSERT INTO listings (seller_id, title, primary_name, description, base_price, price_paise, listing_type, status, ships_in_days, cover_photo_url, category, stock_count, view_count, sale_count)
        VALUES (?, ?, ?, ?, ?, ?, 'custom', 'active', ?, ?, ?, 99, ?, 0)
      `).run(
        sellerId,
        listing.title,
        listing.title,
        listing.description,
        listing.base_price,
        listing.base_price,
        listing.ships_in_days,
        listing.cover_photo_url,
        listing.category,
        Math.floor(Math.random() * 150) + 50
      );
      
      const listingId = res.lastInsertRowid;
      console.log(`Seeded custom listing: "${listing.title}" (ID: ${listingId})`);

      db.prepare(`INSERT INTO listing_photos (listing_id, url, is_cover, sort_order) VALUES (?, ?, 1, 0)`).run(listingId, listing.cover_photo_url);
      db.prepare(`INSERT INTO listing_images (listing_id, image_url, is_cover, sort_order) VALUES (?, ?, 1, 0)`).run(listingId, listing.cover_photo_url);
    }

    // 4. Seed Reviews (`reviews` table)
    const buyerId = 206; // buyer@test.com
    const reviewsToSeed = [
      { rating: 5, body: 'Absolutely gorgeous craftsmanship! Fits perfectly and looks amazing.', reviewer: 'Elias Thorne' },
      { rating: 5, body: 'Exceeded my expectations. Tactile quality is very pleasing and organic.', reviewer: 'Elias Thorne' },
      { rating: 4, body: 'Beautiful piece. Took slightly longer to ship but definitely worth the wait!', reviewer: 'Elias Thorne' },
      { rating: 5, body: 'High quality materials. Very soft and matches description perfectly.', reviewer: 'Elias Thorne' }
    ];

    db.prepare('DELETE FROM reviews WHERE buyer_id = ?').run(buyerId);

    // Seed reviews for products
    let rIdx = 0;
    for (const name in seededProductIds) {
      const productId = seededProductIds[name];
      const r = reviewsToSeed[rIdx % reviewsToSeed.length];
      db.prepare(`
        INSERT INTO reviews (buyer_id, reviewer_id, product_id, rating, body, comment_text, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))
      `).run(buyerId, buyerId, productId, r.rating, r.body, r.body);
      rIdx++;
    }

    // 5. Seed Video Reels (`reels`)
    const mockReels = [
      {
        seller_email: 'sophia@test.com',
        product_name: 'Ornate Amethyst Heart Necklace',
        caption: 'Gazing at the beauty of this handcrafted Amethyst Heart Necklace ✦ #HandmadeJewelry #Artisan',
        video_url: '/uploads/reels/Heart_pendant_on_purple_velvet_202606071100.mp4',
        thumbnail_url: '/uploads/listings/Amethyst_heart_necklace_ornate_s._202606071048.jpeg'
      },
      {
        seller_email: 'kshitija@test.com',
        product_name: 'Ceramic Vase with Lavender Design',
        caption: 'Fresh lavender sprigs in our new hand-painted Lavender Ceramic Vase 🌾 #Stoneware #LavenderVibes',
        video_url: '/uploads/reels/Lavender_sprigs_and_eucalyptus_b._202606071100.mp4',
        thumbnail_url: '/uploads/listings/Ceramic_vase_with_lavender_motif_202606071048.jpeg'
      },
      {
        seller_email: 'sophia@test.com',
        product_name: 'Ornate Amethyst Heart Necklace',
        caption: 'Intricately detailed sterling silver Purple Gemstone Heart Pendant. Handmade with love. 💜',
        video_url: '/uploads/reels/Purple_gemstone_heart_pendant_202606071100.mp4',
        thumbnail_url: '/uploads/listings/Amethyst_heart_necklace_ornate_s._202606071048.jpeg'
      }
    ];

    db.prepare("DELETE FROM reels WHERE seller_id IN (SELECT id FROM users WHERE role='seller')").run();

    for (const r of mockReels) {
      const sellerId = sellerIds[r.seller_email];
      const productId = seededProductIds[r.product_name] || null;

      db.prepare(`
        INSERT INTO reels (seller_id, product_id, title, caption, video_url, thumbnail_url, duration_secs, share_to_instagram, reel_type, visibility, view_count, like_count, comment_count, save_count, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 15, 0, 'showcase', 'public', 120, 45, 12, 8, 'active', datetime('now', '-5 days'))
      `).run(sellerId, productId, r.product_name, r.caption, r.video_url, r.thumbnail_url);
    }
    console.log('Seeded video reels.');

    // 6. Seed Buyer Address & Mock Orders (`addresses`, `orders`, `order_items`)
    // Create address for Elias Thorne (buyer ID: 206)
    db.prepare('DELETE FROM addresses WHERE user_id = ?').run(buyerId);
    
    const addresses = [
      { city: 'Udaipur', state: 'Rajasthan', pincode: '313001', line1: '42, Lake Palace Road' },
      { city: 'Jaipur', state: 'Rajasthan', pincode: '302001', line1: '12, Malviya Nagar' },
      { city: 'Mussoorie', state: 'Uttarakhand', pincode: '248179', line1: '8, Mall Road' },
      { city: 'Delhi', state: 'Delhi', pincode: '110001', line1: '102, Connaught Place' }
    ];

    const addrIds = [];
    for (const addr of addresses) {
      const res = db.prepare(`
        INSERT INTO addresses (user_id, full_name, line1, city, state, pincode, phone, is_default)
        VALUES (?, 'Elias Thorne', ?, ?, ?, ?, '9876543210', 0)
      `).run(buyerId, addr.line1, addr.city, addr.state, addr.pincode);
      addrIds.push(res.lastInsertRowid);
    }
    db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(addrIds[0]);

    // Delete existing orders
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM seller_order_meta').run();
    db.prepare('DELETE FROM order_tracking_events').run();
    db.prepare('DELETE FROM orders').run();

    // Create realistic orders distributed among sellers
    const orderStatuses = ['Awaiting Payment', 'Processing', 'Dispatched', 'Delivered', 'Cancelled'];

    let oIdx = 0;
    for (const l of seededListings) {
      const status = orderStatuses[oIdx % orderStatuses.length];
      const orderRef = 'TF-' + (1001 + oIdx);
      const addrId = addrIds[oIdx % addrIds.length];
      
      const quantity = Math.floor(Math.random() * 2) + 1; // 1 or 2
      const subtotal = l.price_paise * quantity;
      const shipping = 10000; // 100 INR shipping
      const total = subtotal + shipping;
      const platformFee = Math.round(total * 0.08); // 8% fee
      const payout = total - platformFee;

      const orderType = 'pre-made';
      const paymentStatus = status === 'Awaiting Payment' ? 'unpaid' : (status === 'Cancelled' ? 'refunded' : 'paid');

      // Calculate dates in Javascript
      const createdAtDate = new Date();
      createdAtDate.setDate(createdAtDate.getDate() - (oIdx * 3));
      const createdAtStr = createdAtDate.toISOString().replace('T', ' ').substring(0, 19);

      const deadlineDate = new Date(createdAtDate.getTime());
      deadlineDate.setDate(deadlineDate.getDate() + l.ships_in_days);
      const deadlineStr = deadlineDate.toISOString().replace('T', ' ').substring(0, 19);

      // Create Order
      const res = db.prepare(`
        INSERT INTO orders (
          order_ref, buyer_id, seller_id, listing_id, quantity, unit_price, total_amount, 
          platform_fee, seller_payout, order_type, status, payment_status, 
          total_paise, subtotal_paise, shipping_paise, address_id, deadline_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderRef,
        buyerId,
        l.seller_id,
        l.id,
        quantity,
        l.price_paise,
        total,
        platformFee,
        payout,
        orderType,
        status,
        paymentStatus,
        total,
        subtotal,
        shipping,
        addrId,
        deadlineStr,
        createdAtStr,
        createdAtStr
      );

      const orderId = res.lastInsertRowid;

      // Insert Order Item
      db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price_paise, quantity, image_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(orderId, l.id, l.title, l.price_paise, quantity, l.cover_photo_url);

      console.log(`Seeded Order: ${orderRef} (${status}) for listing "${l.title}"`);
      oIdx++;
    }

    // 7. Update database category item_counts based on products seeded
    console.log('Recalculating category item counts...');
    const categoriesList = db.prepare('SELECT id FROM categories').all();
    for (const cat of categoriesList) {
      const prodCount = db.prepare("SELECT COUNT(*) as c FROM products WHERE category_id = ? AND status = 'active'").get(cat.id).c;
      db.prepare('UPDATE categories SET item_count = ?, product_count = ? WHERE id = ?').run(prodCount, prodCount, cat.id);
    }

    db.prepare('COMMIT').run();
    console.log('\nSUCCESS: Database fully seeded with real products, sellers, customized options, orders, and analytics data!');
  } catch (err) {
    db.prepare('ROLLBACK').run();
    console.error('\nERROR seeding database:', err);
    process.exit(1);
  }
}

seed();
