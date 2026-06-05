// Set port to 5001 for part 1 tests
process.env.PORT = 5001;

const { server } = require('./src/server');
const db = require('./src/db');

async function runTests() {
  console.log('=== RUNNING TOHFA PART 1 INTEGRATION TESTS ===');
  const baseUrl = 'http://localhost:5001';
  let exitCode = 0;
  
  try {
    // Clear tables
    db.prepare('DELETE FROM follows').run();
    db.prepare('DELETE FROM saved_reels').run();
    db.prepare('DELETE FROM reel_comments').run();
    db.prepare('DELETE FROM reel_likes').run();
    db.prepare('DELETE FROM reels').run();
    db.prepare('DELETE FROM wishlists').run();
    db.prepare('DELETE FROM reviews').run();
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
    db.prepare('DELETE FROM addresses').run();
    db.prepare('DELETE FROM cart_items').run();
    db.prepare('DELETE FROM product_images').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM refresh_tokens').run();
    db.prepare('DELETE FROM seller_profiles').run();
    db.prepare('DELETE FROM users').run();

    // Reset categories (handled automatically by db.js, let's verify)
    const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    if (categoryCount === 0) {
      throw new Error('Categories were not seeded correctly');
    }
    console.log(`Seeded categories count: ${categoryCount}`);

    // Create a buyer and a seller for testing
    const buyerRegisterRes = await fetch(`${baseUrl}/api/auth/register/buyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test Buyer',
        email: 'buyer@test.com',
        password: 'password123'
      })
    });
    const buyerData = await buyerRegisterRes.json();
    if (buyerRegisterRes.status !== 201) {
      throw new Error(`Failed to create test buyer: ${JSON.stringify(buyerData)}`);
    }
    const buyerToken = buyerData.data.access_token;
    const buyerId = buyerData.data.user.id;

    const sellerRegisterRes = await fetch(`${baseUrl}/api/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test Seller',
        email: 'seller@test.com',
        password: 'password123',
        shop_name: 'Stoneware Studio',
        ships_in_days: 2
      })
    });
    const sellerData = await sellerRegisterRes.json();
    if (sellerRegisterRes.status !== 201) {
      throw new Error(`Failed to create test seller: ${JSON.stringify(sellerData)}`);
    }
    const sellerToken = sellerData.data.access_token;
    const sellerId = sellerData.data.user.id;

    console.log(`Created test buyer ID: ${buyerId}, seller ID: ${sellerId}`);

    // --- TASK 15 TESTS: GET /api/home/feed ---
    console.log('--- Testing TASK 15: GET /api/home/feed ---');
    const feedRes = await fetch(`${baseUrl}/api/home/feed`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Feed Status:', feedRes.status);
    const feedData = await feedRes.json();
    if (feedRes.status !== 200 || !feedData.success || !feedData.data.greeting || !Array.isArray(feedData.data.featured_products) || !Array.isArray(feedData.data.categories)) {
      throw new Error(`Feed response invalid: ${JSON.stringify(feedData)}`);
    }
    console.log('✓ Task 15 Passed: GET /api/home/feed');

    // --- TASK 16 TESTS: GET /api/categories ---
    console.log('--- Testing TASK 16: GET /api/categories ---');
    const catRes = await fetch(`${baseUrl}/api/categories`);
    console.log('Categories Status:', catRes.status);
    const catData = await catRes.json();
    if (catRes.status !== 200 || !catData.success || !Array.isArray(catData.data.categories) || catData.data.categories.length !== 8) {
      throw new Error(`Categories response invalid: ${JSON.stringify(catData)}`);
    }
    console.log('✓ Task 16 Passed: GET /api/categories');

    // --- TASK 17 TESTS: GET /api/categories/:slug/products ---
    console.log('--- Testing TASK 17: GET /api/categories/:slug/products ---');
    // We need to insert a product to test the category products list
    const ceramicsCategory = db.prepare("SELECT id FROM categories WHERE slug = 'ceramics-pottery'").get();
    db.prepare(`
      INSERT INTO products (seller_id, category_id, name, description, price_paise, stock_qty, ships_in_days, status)
      VALUES (?, ?, 'Speckled Moon Bowl', 'Handmade clay bowl', 4800, 5, 1, 'active')
    `).run(sellerId, ceramicsCategory.id);
    const newProductId = db.prepare("SELECT last_insert_rowid() as id").get().id;
    
    // Insert an image for the product
    db.prepare(`
      INSERT INTO product_images (product_id, url, is_primary)
      VALUES (?, 'https://example.com/image.jpg', 1)
    `).run(newProductId);

    const catProdRes = await fetch(`${baseUrl}/api/categories/ceramics-pottery/products`);
    console.log('Category Products Status:', catProdRes.status);
    const catProdData = await catProdRes.json();
    if (catProdRes.status !== 200 || !catProdData.success || catProdData.data.products.length !== 1) {
      throw new Error(`Category Products response invalid: ${JSON.stringify(catProdData)}`);
    }
    const product = catProdData.data.products[0];
    if (product.name !== 'Speckled Moon Bowl' || product.price_paise !== 4800 || product.ready_to_ship !== true || product.image_url !== 'https://example.com/image.jpg') {
      throw new Error(`Product fields mismatch in category feed: ${JSON.stringify(product)}`);
    }

    // Test nonexistent category slug (404)
    const nonexistentCatProdRes = await fetch(`${baseUrl}/api/categories/nonexistent-slug/products`);
    console.log('Nonexistent Category Products Status:', nonexistentCatProdRes.status);
    const nonexistentCatProdData = await nonexistentCatProdRes.json();
    if (nonexistentCatProdRes.status !== 404 || nonexistentCatProdData.code !== 'CATEGORY_NOT_FOUND') {
      throw new Error(`Expected 404 with CATEGORY_NOT_FOUND, got ${nonexistentCatProdRes.status}`);
    }

    console.log('✓ Task 17 Passed: GET /api/categories/:slug/products');

    // --- TASK 18 TESTS: GET /api/products/search ---
    console.log('--- Testing TASK 18: GET /api/products/search ---');
    // Test valid search query
    const searchRes = await fetch(`${baseUrl}/api/products/search?q=Moon`);
    console.log('Search Status:', searchRes.status);
    const searchData = await searchRes.json();
    if (searchRes.status !== 200 || !searchData.success || searchData.data.query !== 'Moon' || searchData.data.products.length !== 1) {
      throw new Error(`Search response invalid: ${JSON.stringify(searchData)}`);
    }
    const searchProduct = searchData.data.products[0];
    if (searchProduct.name !== 'Speckled Moon Bowl' || searchProduct.price_paise !== 4800 || searchProduct.seller_name !== 'Stoneware Studio' || searchProduct.image_url !== 'https://example.com/image.jpg') {
      throw new Error(`Search product fields mismatch: ${JSON.stringify(searchProduct)}`);
    }

    // Test missing query param q
    const missingSearchRes = await fetch(`${baseUrl}/api/products/search`);
    console.log('Missing Search Status:', missingSearchRes.status);
    const missingSearchData = await missingSearchRes.json();
    if (missingSearchRes.status !== 400 || missingSearchData.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected 400 with VALIDATION_ERROR, got ${missingSearchRes.status}`);
    }

    console.log('✓ Task 18 Passed: GET /api/products/search');

    // --- TASK 19 TESTS: GET /api/products/:id ---
    console.log('--- Testing TASK 19: GET /api/products/:id ---');
    // Fetch product with valid ID
    const prodDetailRes = await fetch(`${baseUrl}/api/products/${newProductId}`);
    console.log('Product Details Status:', prodDetailRes.status);
    const prodDetailData = await prodDetailRes.json();
    if (prodDetailRes.status !== 200 || !prodDetailData.success) {
      throw new Error(`Product details fetch failed: ${JSON.stringify(prodDetailData)}`);
    }
    const prodDetails = prodDetailData.data;
    if (prodDetails.name !== 'Speckled Moon Bowl' || prodDetails.price_paise !== 4800 || prodDetails.seller.seller_name !== 'Stoneware Studio' || prodDetails.category.slug !== 'ceramics-pottery' || prodDetails.is_wishlisted !== false) {
      throw new Error(`Product details mismatch: ${JSON.stringify(prodDetails)}`);
    }

    // Insert a review to test recent_reviews
    db.prepare(`
      INSERT INTO reviews (product_id, reviewer_id, rating, body)
      VALUES (?, ?, 5, 'Absolutely perfect!')
    `).run(newProductId, buyerId);

    // Fetch product with review, authenticated to check is_wishlisted after wishlisting
    db.prepare(`INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)`).run(buyerId, newProductId);

    const authProdDetailRes = await fetch(`${baseUrl}/api/products/${newProductId}`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Auth Product Details Status:', authProdDetailRes.status);
    const authProdDetailData = await authProdDetailRes.json();
    if (authProdDetailRes.status !== 200 || !authProdDetailData.success) {
      throw new Error(`Auth product details fetch failed: ${JSON.stringify(authProdDetailData)}`);
    }
    const authProdDetails = authProdDetailData.data;
    if (authProdDetails.is_wishlisted !== true || authProdDetails.recent_reviews.length !== 1 || authProdDetails.recent_reviews[0].reviewer_name !== 'Test Buyer') {
      throw new Error(`Auth product details mismatch: ${JSON.stringify(authProdDetails)}`);
    }

    // Update stock to 0 and verify status becomes 'sold_out'
    db.prepare("UPDATE products SET stock_qty = 0 WHERE id = ?").run(newProductId);
    const soldOutRes = await fetch(`${baseUrl}/api/products/${newProductId}`);
    const soldOutData = await soldOutRes.json();
    if (soldOutData.data.status !== 'sold_out') {
      throw new Error(`Expected status to be 'sold_out', got: ${soldOutData.data.status}`);
    }

    // Reset stock qty back
    db.prepare("UPDATE products SET stock_qty = 5 WHERE id = ?").run(newProductId);

    // Test nonexistent product (404)
    const nonexistentProdRes = await fetch(`${baseUrl}/api/products/999999`);
    console.log('Nonexistent Product Status:', nonexistentProdRes.status);
    const nonexistentProdData = await nonexistentProdRes.json();
    if (nonexistentProdRes.status !== 404 || nonexistentProdData.code !== 'PRODUCT_NOT_FOUND') {
      throw new Error(`Expected 404 with PRODUCT_NOT_FOUND, got ${nonexistentProdRes.status}`);
    }

    console.log('✓ Task 19 Passed: GET /api/products/:id');

  } catch (err) {
    console.error('❌ Integration test failed:', err.message);
    console.error(err.stack);
    exitCode = 1;
  } finally {
    server.close(() => {
      console.log('Integration test server closed');
      process.exit(exitCode);
    });
  }
}

// Start tests
setTimeout(runTests, 200);
