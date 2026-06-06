// Quick smoke test for Part 4 seller routes
const { app, server } = require('./src/server.js');
const db = require('./src/db.js');

const PORT = process.env.PORT || 5000;
const baseUrl = 'http://localhost:' + PORT;

async function runTests() {
  let exitCode = 0;
  try {
    // Create a test seller user
    db.prepare("DELETE FROM users WHERE email = 'seller4@test.com'").run();
    const bcrypt = require('bcrypt');
    const hash = bcrypt.hashSync('TestPass123', 10);
    db.prepare("INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'buyer')").run('seller4@test.com', hash, 'Test Seller4');
    const userId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // --- Test Task 42: POST /api/seller/become ---
    console.log('--- Testing TASK 42: POST /api/seller/become ---');
    // Login as buyer
    console.log('Logging in as buyer...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'seller4@test.com', password: 'TestPass123' })
    });
    console.log('Login Response Status:', loginRes.status);
    const loginText = await loginRes.text();
    console.log('Login Response Text:', loginText);
    const loginData = JSON.parse(loginText);
    const token = loginData.data.access_token;

    // Become seller
    console.log('Sending become request...');
    const becomeRes = await fetch(`${baseUrl}/api/seller/become`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ display_name: 'Test Studio 4', handle: 'test_studio_4', store_currency: 'INR' })
    });
    console.log('Become Response Status:', becomeRes.status);
    const becomeText = await becomeRes.text();
    console.log('Become Response Text:', becomeText);
    const becomeData = JSON.parse(becomeText);
    if (becomeRes.status !== 201 || !becomeData.success) throw new Error(`Task 42 fail: ${JSON.stringify(becomeData)}`);
    if (!becomeData.data.seller_id || !becomeData.data.handle || !becomeData.data.store_slug) throw new Error(`Task 42 shape fail: ${JSON.stringify(becomeData.data)}`);
    console.log('✓ Task 42 Passed: POST /api/seller/become');

    // Already seller → 409
    const dupRes = await fetch(`${baseUrl}/api/seller/become`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ display_name: 'Test Studio 4', handle: 'test_studio_4b', store_currency: 'INR' })
    });
    if (dupRes.status !== 409) throw new Error(`Task 42: Expected 409 for already seller, got ${dupRes.status}`);

    // Re-login to get seller-role token
    const loginRes2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'seller4@test.com', password: 'TestPass123' })
    });
    const loginData2 = await loginRes2.json();
    const sellerToken = loginData2.data.access_token;

    // --- Test Task 16: GET /api/seller/dashboard ---
    console.log('--- Testing TASK 16: GET /api/seller/dashboard ---');
    const dashRes = await fetch(`${baseUrl}/api/seller/dashboard`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    const dashData = await dashRes.json();
    if (dashRes.status !== 200 || !dashData.success) throw new Error(`Task 16 fail: ${JSON.stringify(dashData)}`);
    if (!dashData.data.seller || !dashData.data.kpis || !Array.isArray(dashData.data.announcements)) throw new Error(`Task 16 shape fail`);
    console.log('✓ Task 16 Passed: GET /api/seller/dashboard');

    // --- Test Task 17: GET /api/seller/profile ---
    console.log('--- Testing TASK 17: GET /api/seller/profile ---');
    const profRes = await fetch(`${baseUrl}/api/seller/profile`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    const profData = await profRes.json();
    if (profRes.status !== 200 || !profData.success) throw new Error(`Task 17 fail: ${JSON.stringify(profData)}`);
    if (!profData.data.seller_id || profData.data.handle !== 'test_studio_4') throw new Error(`Task 17 shape fail: ${JSON.stringify(profData.data)}`);
    console.log('✓ Task 17 Passed: GET /api/seller/profile');

    // --- Test Task 18: PUT /api/seller/profile ---
    console.log('--- Testing TASK 18: PUT /api/seller/profile ---');
    const putProfRes = await fetch(`${baseUrl}/api/seller/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sellerToken}` },
      body: JSON.stringify({ bio: 'Artisan crafts from the hills', location: 'Shimla' })
    });
    const putProfData = await putProfRes.json();
    if (putProfRes.status !== 200 || !putProfData.success) throw new Error(`Task 18 fail: ${JSON.stringify(putProfData)}`);
    if (putProfData.data.bio !== 'Artisan crafts from the hills') throw new Error(`Task 18 bio not updated`);
    // Handle taken
    const handleTakenRes = await fetch(`${baseUrl}/api/seller/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sellerToken}` },
      body: JSON.stringify({ handle: 'Test_INVALID Handle' })
    });
    if (handleTakenRes.status !== 400) throw new Error(`Task 18: expected 400 for invalid handle, got ${handleTakenRes.status}`);
    console.log('✓ Task 18 Passed: PUT /api/seller/profile');

    // --- Test Task 19: GET /api/seller/listings (empty) ---
    console.log('--- Testing TASK 19: GET /api/seller/listings ---');
    const listRes = await fetch(`${baseUrl}/api/seller/listings`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    const listData = await listRes.json();
    if (listRes.status !== 200 || !listData.success) throw new Error(`Task 19 fail: ${JSON.stringify(listData)}`);
    if (typeof listData.data.total !== 'number' || !Array.isArray(listData.data.listings)) throw new Error(`Task 19 shape fail`);
    console.log('✓ Task 19 Passed: GET /api/seller/listings');

    // --- Test Task 20: POST /api/seller/listings ---
    console.log('--- Testing TASK 20: POST /api/seller/listings ---');
    const createListRes = await fetch(`${baseUrl}/api/seller/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sellerToken}` },
      body: JSON.stringify({
        title: 'Moonlight Jasmine Reel Study',
        description: 'A beautiful handmade piece',
        category: 'Botanical Art',
        price_paise: 245000,
        stock_count: 5,
        status: 'active',
        tags: ['#BOTANICAL', '#HANDMADE'],
        photo_urls: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg']
      })
    });
    const createListData = await createListRes.json();
    if (createListRes.status !== 201 || !createListData.success) throw new Error(`Task 20 fail: ${JSON.stringify(createListData)}`);
    const listingId = createListData.data.listing_id;
    if (!listingId || !createListData.data.title) throw new Error(`Task 20 shape fail`);
    console.log('✓ Task 20 Passed: POST /api/seller/listings');

    // --- Test Task 21: GET /api/seller/listings/:id ---
    console.log('--- Testing TASK 21: GET /api/seller/listings/:id ---');
    const getListRes = await fetch(`${baseUrl}/api/seller/listings/${listingId}`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    const getListData = await getListRes.json();
    if (getListRes.status !== 200 || !getListData.success) throw new Error(`Task 21 fail: ${JSON.stringify(getListData)}`);
    if (getListData.data.listing_id !== listingId || !Array.isArray(getListData.data.photos)) throw new Error(`Task 21 shape fail`);
    console.log('✓ Task 21 Passed: GET /api/seller/listings/:id');

    // --- Test Task 22: PUT /api/seller/listings/:id ---
    console.log('--- Testing TASK 22: PUT /api/seller/listings/:id ---');
    const updListRes = await fetch(`${baseUrl}/api/seller/listings/${listingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sellerToken}` },
      body: JSON.stringify({ stock_count: 10, status: 'paused' })
    });
    const updListData = await updListRes.json();
    if (updListRes.status !== 200 || !updListData.success) throw new Error(`Task 22 fail: ${JSON.stringify(updListData)}`);
    if (updListData.data.stock_count !== 10 || updListData.data.status !== 'paused') throw new Error(`Task 22 value fail`);
    console.log('✓ Task 22 Passed: PUT /api/seller/listings/:id');

    // --- Test Task 23: DELETE /api/seller/listings/:id ---
    console.log('--- Testing TASK 23: DELETE /api/seller/listings/:id ---');
    // Create a throwaway listing
    const throwRes = await fetch(`${baseUrl}/api/seller/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sellerToken}` },
      body: JSON.stringify({ title: 'To Delete', price_paise: 1000, stock_count: 1 })
    });
    const throwData = await throwRes.json();
    const throwId = throwData.data.listing_id;
    const delRes = await fetch(`${baseUrl}/api/seller/listings/${throwId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    const delData = await delRes.json();
    if (delRes.status !== 200 || delData.data.status !== 'deleted') throw new Error(`Task 23 fail: ${JSON.stringify(delData)}`);
    console.log('✓ Task 23 Passed: DELETE /api/seller/listings/:id');

    // --- Test Task 26: GET /api/seller/orders ---
    console.log('--- Testing TASK 26: GET /api/seller/orders ---');
    const ordRes = await fetch(`${baseUrl}/api/seller/orders`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    const ordData = await ordRes.json();
    if (ordRes.status !== 200 || !ordData.success) throw new Error(`Task 26 fail: ${JSON.stringify(ordData)}`);
    if (typeof ordData.data.total !== 'number' || !Array.isArray(ordData.data.orders)) throw new Error(`Task 26 shape fail`);
    console.log('✓ Task 26 Passed: GET /api/seller/orders');

    // --- Test Task 30: GET /api/seller/reviews ---
    console.log('--- Testing TASK 30: GET /api/seller/reviews ---');
    const revRes = await fetch(`${baseUrl}/api/seller/reviews`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    const revData = await revRes.json();
    if (revRes.status !== 200 || !revData.success) throw new Error(`Task 30 fail: ${JSON.stringify(revData)}`);
    if (!revData.data.summary || !Array.isArray(revData.data.reviews)) throw new Error(`Task 30 shape fail`);
    console.log('✓ Task 30 Passed: GET /api/seller/reviews');

    // --- Test Task 32: GET /api/seller/analytics ---
    console.log('--- Testing TASK 32: GET /api/seller/analytics ---');
    const analytRes = await fetch(`${baseUrl}/api/seller/analytics`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    const analytData = await analytRes.json();
    if (analytRes.status !== 200 || !analytData.success) throw new Error(`Task 32 fail: ${JSON.stringify(analytData)}`);
    if (!analytData.data.kpis || !analytData.data.traffic) throw new Error(`Task 32 shape fail`);
    console.log('✓ Task 32 Passed: GET /api/seller/analytics');

    // --- Test Task 33: GET /api/seller/store-config ---
    console.log('--- Testing TASK 33: GET /api/seller/store-config ---');
    const scRes = await fetch(`${baseUrl}/api/seller/store-config`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    const scData = await scRes.json();
    if (scRes.status !== 200 || !scData.success) throw new Error(`Task 33 fail: ${JSON.stringify(scData)}`);
    if (!scData.data.onboarding_steps || typeof scData.data.steps_complete !== 'number') throw new Error(`Task 33 shape fail`);
    console.log('✓ Task 33 Passed: GET /api/seller/store-config');

    // --- Test Task 34: PUT /api/seller/store-config ---
    console.log('--- Testing TASK 34: PUT /api/seller/store-config ---');
    const putScRes = await fetch(`${baseUrl}/api/seller/store-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sellerToken}` },
      body: JSON.stringify({ accept_orders: false })
    });
    const putScData = await putScRes.json();
    if (putScRes.status !== 200 || !putScData.success) throw new Error(`Task 34 fail: ${JSON.stringify(putScData)}`);
    console.log('✓ Task 34 Passed: PUT /api/seller/store-config');

    // --- Test Task 35: GET /api/seller/payouts ---
    console.log('--- Testing TASK 35: GET /api/seller/payouts ---');
    const payRes = await fetch(`${baseUrl}/api/seller/payouts`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    const payData = await payRes.json();
    if (payRes.status !== 200 || !payData.success) throw new Error(`Task 35 fail: ${JSON.stringify(payData)}`);
    if (typeof payData.data.current_balance_paise !== 'number' || !Array.isArray(payData.data.payouts)) throw new Error(`Task 35 shape fail`);
    console.log('✓ Task 35 Passed: GET /api/seller/payouts');

    // --- Test Task 36: PUT /api/seller/zai-mode ---
    console.log('--- Testing TASK 36: PUT /api/seller/zai-mode ---');
    const zaiRes = await fetch(`${baseUrl}/api/seller/zai-mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sellerToken}` },
      body: JSON.stringify({ enabled: true })
    });
    const zaiData = await zaiRes.json();
    if (zaiRes.status !== 200 || !zaiData.success || zaiData.data.enabled !== true) throw new Error(`Task 36 fail: ${JSON.stringify(zaiData)}`);
    // Toggle off
    const zaiOffRes = await fetch(`${baseUrl}/api/seller/zai-mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sellerToken}` },
      body: JSON.stringify({ enabled: false })
    });
    const zaiOffData = await zaiOffRes.json();
    if (zaiOffData.data.enabled !== false) throw new Error(`Task 36 toggle off fail`);
    console.log('✓ Task 36 Passed: PUT /api/seller/zai-mode');

    console.log('\n✅ ALL PART 4 API SMOKE TESTS PASSED');
  } catch (err) {
    console.error('❌ Smoke test failed:', err.stack);
    exitCode = 1;
  } finally {
    server.close(() => {
      process.exit(exitCode);
    });
  }
}

setTimeout(runTests, 300);
