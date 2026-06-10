// Test script for customizations endpoints
process.env.PORT = '5001';
const { app, server } = require('./src/server.js');
const db = require('./src/db.js');

const PORT = process.env.PORT || 5001;
const baseUrl = 'http://localhost:' + PORT;

async function runTests() {
  let exitCode = 0;
  try {
    console.log('--- Cleaning up database ---');
    db.prepare("DELETE FROM reviews WHERE body = 'Test Review Body'").run();
    db.prepare("DELETE FROM listing_images WHERE image_url LIKE '%test-image%'").run();
    db.prepare("DELETE FROM listing_photos WHERE url LIKE '%test-photo%'").run();
    db.prepare("DELETE FROM listings WHERE title LIKE 'Test Customization Listing%'").run();
    db.prepare("DELETE FROM store_config WHERE seller_id IN (SELECT id FROM users WHERE email = 'test_cust_seller@test.com')").run();
    db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email = 'test_cust_seller@test.com')").run();
    db.prepare("DELETE FROM users WHERE email = 'test_cust_seller@test.com'").run();
    db.prepare("DELETE FROM users WHERE email = 'test_cust_buyer@test.com'").run();

    console.log('--- Seeding test database ---');
    // Seller User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role, avatar_url)
      VALUES ('test_cust_seller@test.com', 'hash', 'Jane Seller', 'seller', 'https://example.com/avatar.png')
    `).run();
    const sellerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Seller Profile
    db.prepare(`
      INSERT INTO seller_profiles (user_id, shop_name, is_approved, shop_bio)
      VALUES (?, 'Jane Resin Art Shop', 1, 'We make the best resin craft')
    `).run(sellerId);

    // Store Config
    db.prepare(`
      INSERT INTO store_config (seller_id, city, artist_bio)
      VALUES (?, 'Mumbai', 'Artist bio info here')
    `).run(sellerId);

    // Buyer User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_cust_buyer@test.com', 'hash', 'John Buyer', 'buyer')
    `).run();
    const buyerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Custom listing 1 (resin_art)
    db.prepare(`
      INSERT INTO listings (seller_id, title, description, category, base_price, ships_in_days, cover_photo_url, listing_type, status, view_count, created_at)
      VALUES (?, 'Test Customization Listing 1', 'Resin coaster', 'resin_art', 50000, 5, 'https://example.com/cover1.png', 'custom', 'active', 10, '2026-06-01T00:00:00Z')
    `).run(sellerId);
    const listingId1 = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Photos for listing 1
    db.prepare(`
      INSERT INTO listing_photos (listing_id, url, sort_order)
      VALUES (?, 'https://example.com/test-photo-1.png', 1)
    `).run(listingId1);
    db.prepare(`
      INSERT INTO listing_photos (listing_id, url, sort_order)
      VALUES (?, 'https://example.com/test-photo-2.png', 2)
    `).run(listingId1);

    // Review for listing 1
    db.prepare(`
      INSERT INTO reviews (listing_id, reviewer_id, rating, body, created_at)
      VALUES (?, ?, 5, 'Test Review Body', '2026-06-05T00:00:00Z')
    `).run(listingId1, buyerId);

    // Custom listing 2 (jewellery)
    db.prepare(`
      INSERT INTO listings (seller_id, title, description, category, base_price, ships_in_days, cover_photo_url, listing_type, status, view_count, created_at)
      VALUES (?, 'Test Customization Listing 2', 'Resin ring', 'jewellery', 30000, 3, 'https://example.com/cover2.png', 'custom', 'active', 5, '2026-06-02T00:00:00Z')
    `).run(sellerId);
    const listingId2 = db.prepare("SELECT last_insert_rowid() as id").get().id;

    console.log('--- Testing /api/customizations/tags ---');
    const tagsRes = await fetch(`${baseUrl}/api/customizations/tags`);
    console.log('GET /api/customizations/tags status:', tagsRes.status);
    const tagsData = await tagsRes.json();
    console.log('GET /api/customizations/tags body:', JSON.stringify(tagsData));
    if (tagsRes.status !== 200) throw new Error('Tags status not 200');
    if (!Array.isArray(tagsData.tags)) throw new Error('Tags is not an array');
    if (!tagsData.tags.includes('resin_art')) throw new Error('resin_art missing from tags');

    console.log('--- Testing /api/customizations (no params) ---');
    const listRes = await fetch(`${baseUrl}/api/customizations`);
    console.log('GET /api/customizations status:', listRes.status);
    const listData = await listRes.json();
    console.log('GET /api/customizations body:', JSON.stringify(listData));
    if (listRes.status !== 200) throw new Error('List status not 200');
    if (typeof listData.total !== 'number' || listData.total < 2) throw new Error('Invalid total count');
    if (!Array.isArray(listData.services) || listData.services.length < 2) throw new Error('Services array invalid');
    
    // Verify first item is Listing 1 (since default sort is popular, and listing 1 has view_count=10 > listing 2 has view_count=5)
    const firstService = listData.services.find(s => s.listing_id === listingId1);
    if (!firstService) throw new Error('Listing 1 not found in services');
    if (firstService.product_name !== 'Test Customization Listing 1') throw new Error('Product name mismatch');
    if (firstService.base_price !== 500) throw new Error('Base price mismatch (expected 500 INR, got ' + firstService.base_price + ')');
    if (firstService.lead_time_days !== 5) throw new Error('Lead time days mismatch');
    if (firstService.cover_image_url !== 'https://example.com/cover1.png') throw new Error('Cover photo URL mismatch');
    if (firstService.avg_rating !== 5.0) throw new Error('Avg rating mismatch: ' + firstService.avg_rating);
    if (firstService.review_count !== 1) throw new Error('Review count mismatch: ' + firstService.review_count);
    if (firstService.seller_name !== 'Jane Resin Art Shop') throw new Error('Seller name mismatch: ' + firstService.seller_name);
    if (firstService.is_verified_seller !== true) throw new Error('is_verified_seller mismatch');

    console.log('--- Testing /api/customizations?tag=resin_art ---');
    const filteredRes = await fetch(`${baseUrl}/api/customizations?tag=resin_art`);
    console.log('GET /api/customizations?tag=resin_art status:', filteredRes.status);
    const filteredData = await filteredRes.json();
    console.log('GET /api/customizations?tag=resin_art body:', JSON.stringify(filteredData));
    if (filteredRes.status !== 200) throw new Error('Filtered list status not 200');
    const hasJewellery = filteredData.services.some(s => s.product_type_tag === 'jewellery');
    if (hasJewellery) throw new Error('Filter by tag failed: returned jewellery');
    const hasResin = filteredData.services.some(s => s.product_type_tag === 'resin_art');
    if (!hasResin) throw new Error('Filter by tag failed: resin_art missing');

    console.log('--- Testing /api/customizations/:listing_id (Listing 1) ---');
    const detailRes = await fetch(`${baseUrl}/api/customizations/${listingId1}`);
    console.log('GET /api/customizations/:listing_id status:', detailRes.status);
    const detailData = await detailRes.json();
    console.log('GET /api/customizations/:listing_id body:', JSON.stringify(detailData));
    if (detailRes.status !== 200) throw new Error('Detail status not 200');
    if (detailData.listing_id !== listingId1) throw new Error('Listing ID mismatch in detail');
    if (detailData.seller_city !== 'Mumbai') throw new Error('Seller city mismatch: ' + detailData.seller_city);
    if (detailData.seller_bio !== 'Artist bio info here') throw new Error('Seller bio mismatch: ' + detailData.seller_bio);
    if (!Array.isArray(detailData.gallery_images) || detailData.gallery_images.length !== 2) throw new Error('Gallery images invalid');
    if (detailData.gallery_images[0] !== 'https://example.com/test-photo-1.png') throw new Error('Gallery image 1 mismatch');
    
    // Reviews details
    if (!Array.isArray(detailData.reviews) || detailData.reviews.length !== 1) throw new Error('Reviews invalid');
    if (detailData.reviews[0].buyer_name !== 'John Buyer') throw new Error('Reviewer buyer_name mismatch');
    if (detailData.reviews[0].review_text !== 'Test Review Body') throw new Error('Review text mismatch');
    if (detailData.reviews[0].rating !== 5) throw new Error('Review rating mismatch');

    // Questions preview details
    if (!Array.isArray(detailData.questions_preview) || detailData.questions_preview.length === 0) throw new Error('Questions preview is empty or invalid');
    console.log('Questions preview size:', detailData.questions_preview.length);
    if (detailData.questions_preview[0].product_type_tag !== 'resin_art') throw new Error('Questions preview product type tag mismatch');

    console.log('--- Testing /api/customizations/999999 (Not Found) ---');
    const nfRes = await fetch(`${baseUrl}/api/customizations/999999`);
    console.log('GET /api/customizations/999999 status:', nfRes.status);
    const nfData = await nfRes.json();
    console.log('GET /api/customizations/999999 body:', JSON.stringify(nfData));
    if (nfRes.status !== 404) throw new Error('Expected 404 for non-existent listing');
    if (!nfData.error) throw new Error('Expected error message in response');

    // --- Non-API Prefixed Route Tests (Aliases) ---
    console.log('--- Testing /customizations/tags (alias) ---');
    const aliasTagsRes = await fetch(`${baseUrl}/customizations/tags`);
    if (aliasTagsRes.status !== 200) throw new Error('Alias tags status not 200');
    const aliasTagsData = await aliasTagsRes.json();
    if (!aliasTagsData.tags.includes('resin_art')) throw new Error('resin_art missing in alias tags');

    console.log('--- Testing /customizations (alias) ---');
    const aliasListRes = await fetch(`${baseUrl}/customizations`);
    if (aliasListRes.status !== 200) throw new Error('Alias list status not 200');
    const aliasListData = await aliasListRes.json();
    if (aliasListData.total < 2) throw new Error('Alias list total count invalid');

    console.log('--- Testing /customizations/:listing_id (alias) ---');
    const aliasDetailRes = await fetch(`${baseUrl}/customizations/${listingId1}`);
    if (aliasDetailRes.status !== 200) throw new Error('Alias detail status not 200');
    const aliasDetailData = await aliasDetailRes.json();
    if (aliasDetailData.listing_id !== listingId1) throw new Error('Alias listing ID mismatch');

    console.log('✅ ALL CUSTOMIZATIONS ENDPOINT TESTS PASSED!');
  } catch (err) {
    console.error('❌ Tests failed:', err.stack);
    exitCode = 1;
  } finally {
    console.log('--- Cleaning up database ---');
    try {
      db.prepare("DELETE FROM reviews WHERE body = 'Test Review Body'").run();
      db.prepare("DELETE FROM listing_images WHERE image_url LIKE '%test-image%'").run();
      db.prepare("DELETE FROM listing_photos WHERE url LIKE '%test-photo%'").run();
      db.prepare("DELETE FROM listings WHERE title LIKE 'Test Customization Listing%'").run();
      db.prepare("DELETE FROM store_config WHERE seller_id IN (SELECT id FROM users WHERE email = 'test_cust_seller@test.com')").run();
      db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email = 'test_cust_seller@test.com')").run();
      db.prepare("DELETE FROM users WHERE email = 'test_cust_seller@test.com'").run();
      db.prepare("DELETE FROM users WHERE email = 'test_cust_buyer@test.com'").run();
    } catch (e) {
      console.error('Failed to clean up:', e.message);
    }
    server.close(() => {
      console.log('Server closed.');
      process.exit(exitCode);
    });
  }
}

setTimeout(runTests, 300);
