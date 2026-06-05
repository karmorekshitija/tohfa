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
