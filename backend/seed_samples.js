const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'tohfa.db');
console.log('Connecting to database at:', dbPath);
const db = new Database(dbPath);

try {
  // Start Transaction
  db.prepare('BEGIN TRANSACTION').run();

  const sellerId = 139; // Active test seller: seller@test.com
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Define products to insert
  const products = [
    {
      seller_id: sellerId,
      category_id: 1, // Textile Arts
      name: 'Crochet Amigurumi Heart Plushie',
      description: 'A cute hand-crocheted heart plushie made with soft organic cotton yarn. Perfect for gifting or desk decoration.',
      price_paise: 35000,
      stock_qty: 15,
      ships_in_days: 2,
      imageUrl: '/uploads/listings/crochet_heart_plushie.jpeg'
    },
    {
      seller_id: sellerId,
      category_id: 2, // Jewellery
      name: 'Amethyst Heart Necklace',
      description: 'An ornate sterling silver pendant featuring a beautifully polished heart-shaped amethyst gemstone. Handcrafted with intricate details.',
      price_paise: 125000,
      stock_qty: 5,
      ships_in_days: 3,
      imageUrl: '/uploads/listings/amethyst_heart_necklace.jpeg'
    },
    {
      seller_id: sellerId,
      category_id: 3, // Ceramics
      name: 'Ceramic Vase with Lavender Motif',
      description: 'A hand-thrown stoneware ceramic vase decorated with delicate hand-painted lavender designs. Perfect for dry or fresh floral arrangements.',
      price_paise: 85000,
      stock_qty: 8,
      ships_in_days: 2,
      imageUrl: '/uploads/listings/ceramic_vase_lavender.jpeg'
    },
    {
      seller_id: sellerId,
      category_id: 4, // Journals & Stationery
      name: 'Vintage Literature Leather Journal',
      description: 'A beautifully hand-bound literature journal featuring thick deckled-edge paper and a rustic brown leather strap closure.',
      price_paise: 60000,
      stock_qty: 12,
      ships_in_days: 1,
      imageUrl: '/uploads/listings/literature_leather_journal.jpeg'
    },
    {
      seller_id: sellerId,
      category_id: 7, // Customized Gifts
      name: 'Monogrammed Linen Robe',
      description: 'Ultra-soft premium organic linen robe with custom monogram embroidery. Made to order for a perfect personal touch.',
      price_paise: 180000,
      stock_qty: 10,
      ships_in_days: 4,
      imageUrl: '/uploads/listings/linen_robe_monogram.jpeg'
    }
  ];

  const productIds = {};

  const insertProduct = db.prepare(`
    INSERT INTO products (seller_id, category_id, name, description, price_paise, stock_qty, ships_in_days, status, avg_rating, review_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, ?, ?)
  `);

  const insertImage = db.prepare(`
    INSERT INTO product_images (product_id, url, is_primary, sort_order)
    VALUES (?, ?, 1, 0)
  `);

  for (const p of products) {
    // Insert product
    const res = insertProduct.run(
      p.seller_id,
      p.category_id,
      p.name,
      p.description,
      p.price_paise,
      p.stock_qty,
      p.ships_in_days,
      now,
      now
    );
    const productId = res.lastInsertRowid;
    productIds[p.name] = productId;
    console.log(`Inserted product: "${p.name}" with ID: ${productId}`);

    // Insert product image
    insertImage.run(productId, p.imageUrl);
    console.log(`Associated image: ${p.imageUrl} with product ID: ${productId}`);
  }

  // Insert reels linking to these products
  const reels = [
    {
      seller_id: sellerId,
      product_id: productIds['Amethyst_heart_necklace'] || productIds['Amethyst Heart Necklace'],
      caption: 'Gazing at the beauty of this handcrafted Amethyst Heart Necklace ✦ #HandmadeJewelry #Artisan',
      video_url: '/uploads/reels/heart_pendant_purple_velvet.mp4',
      thumbnail_url: '/uploads/listings/amethyst_heart_necklace.jpeg',
      duration_secs: 15
    },
    {
      seller_id: sellerId,
      product_id: productIds['Ceramic Vase with Lavender Motif'],
      caption: 'Fresh lavender sprigs in our new hand-painted Lavender Ceramic Vase 🌾 #Stoneware #LavenderVibes',
      video_url: '/uploads/reels/lavender_sprigs_eucalyptus.mp4',
      thumbnail_url: '/uploads/listings/ceramic_vase_lavender.jpeg',
      duration_secs: 15
    },
    {
      seller_id: sellerId,
      product_id: productIds['Amethyst_heart_necklace'] || productIds['Amethyst Heart Necklace'],
      caption: 'Intricately detailed sterling silver Purple Gemstone Heart Pendant. Handmade with love. 💜',
      video_url: '/uploads/reels/purple_gemstone_heart.mp4',
      thumbnail_url: '/uploads/listings/amethyst_heart_necklace.jpeg',
      duration_secs: 15
    }
  ];

  const insertReel = db.prepare(`
    INSERT INTO reels (seller_id, product_id, caption, video_url, thumbnail_url, duration_secs, status, like_count, comment_count, save_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', 0, 0, 0, ?)
  `);

  for (const r of reels) {
    const res = insertReel.run(
      r.seller_id,
      r.product_id || null,
      r.caption,
      r.video_url,
      r.thumbnail_url,
      r.duration_secs,
      now
    );
    console.log(`Inserted reel with ID: ${res.lastInsertRowid}`);
  }

  db.prepare('COMMIT').run();
  console.log('\nSUCCESS: Sample database seeding completed successfully!');
} catch (err) {
  db.prepare('ROLLBACK').run();
  console.error('\nERROR: Database transaction rolled back due to error:', err);
  process.exit(1);
}
