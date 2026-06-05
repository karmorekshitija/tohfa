// Quick smoke test for Part 2 admin routes
const { app, server } = require('./src/server.js');
const db = require('./src/db.js');

const PORT = process.env.PORT || 5001;
const baseUrl = 'http://localhost:' + PORT;

async function runTests() {
  let exitCode = 0;
  try {
    db.prepare("PRAGMA foreign_keys = OFF").run();
    // 1. Prepare/seed test admin
    db.prepare("DELETE FROM admin_users WHERE username = 'testadmin'").run();
    const bcrypt = require('bcrypt');
    const hash = bcrypt.hashSync('AdminPass@123', 10);
    db.prepare("INSERT INTO admin_users (username, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, 'super_admin')")
      .run('testadmin', 'testadmin@tohfa.in', hash, 'Test Admin');
    const adminId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // 2. Prepare test seller and buyer
    db.prepare("DELETE FROM users WHERE email IN ('test_seller@tohfa.in', 'test_buyer@tohfa.in')").run();
    const userHash = bcrypt.hashSync('UserPass@123', 10);
    
    db.prepare("INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'seller')")
      .run('test_seller@tohfa.in', userHash, 'Test Seller');
    const sellerUserId = db.prepare("SELECT last_insert_rowid() as id").get().id;
    
    db.prepare("INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'buyer')")
      .run('test_buyer@tohfa.in', userHash, 'Test Buyer');
    const buyerUserId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Seed seller profile
    db.prepare("DELETE FROM seller_profiles WHERE user_id = ? OR handle = ?").run(sellerUserId, 'test_seller_studio');
    db.prepare("INSERT INTO seller_profiles (user_id, display_name, handle, shop_name, is_accepting_orders) VALUES (?, ?, ?, ?, 1)")
      .run(sellerUserId, 'Test Seller Studio', 'test_seller_studio', 'Test Seller Studio');
    const sellerProfileId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Seed test product
    db.prepare("DELETE FROM products WHERE seller_id = ?").run(sellerUserId);
    db.prepare("INSERT INTO products (seller_id, name, price_paise, stock_qty, status) VALUES (?, ?, ?, ?, 'active')")
      .run(sellerUserId, 'Artisan Ceramic Jug', 150000, 10);
    const productId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Seed test orders and items
    db.prepare("DELETE FROM orders WHERE order_ref = 'ORD-TEST-99'").run();
    db.prepare("INSERT INTO orders (id, order_ref, buyer_id, subtotal_paise, total_paise, status) VALUES (99, 'ORD-TEST-99', ?, ?, ?, 'processing')")
      .run(buyerUserId, 150000, 150000);
    
    db.prepare("DELETE FROM order_items WHERE order_id = 99").run();
    db.prepare("INSERT INTO order_items (order_id, product_id, product_name, unit_price_paise, quantity) VALUES (99, ?, 'Artisan Ceramic Jug', 150000, 1)")
      .run(productId);
    db.prepare("PRAGMA foreign_keys = ON").run();

    // --- Test Task 08: POST /api/admin/auth/login ---
    console.log('--- Testing TASK 08: POST /api/admin/auth/login ---');
    const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testadmin', password: 'AdminPass@123' })
    });
    console.log('Login Status:', loginRes.status);
    const loginData = await loginRes.json();
    if (loginRes.status !== 200 || !loginData.success) {
      throw new Error(`Task 08 fail: ${JSON.stringify(loginData)}`);
    }
    const token = loginData.data.access_token;
    console.log('✓ Task 08 Passed: Admin login');

    // --- Test Task 09: GET /api/admin/sellers ---
    console.log('--- Testing TASK 09: GET /api/admin/sellers ---');
    const sellersRes = await fetch(`${baseUrl}/api/admin/sellers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Sellers Status:', sellersRes.status);
    const sellersData = await sellersRes.json();
    if (sellersRes.status !== 200 || !sellersData.success || !Array.isArray(sellersData.data.sellers)) {
      throw new Error(`Task 09 fail: ${JSON.stringify(sellersData)}`);
    }
    console.log('✓ Task 09 Passed: Get sellers directory');

    // --- Test Task 10: GET /api/admin/sellers/:id ---
    console.log('--- Testing TASK 10: GET /api/admin/sellers/:id ---');
    const sellerDetailRes = await fetch(`${baseUrl}/api/admin/sellers/${sellerUserId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Seller Detail Status:', sellerDetailRes.status);
    const sellerDetailData = await sellerDetailRes.json();
    if (sellerDetailRes.status !== 200 || !sellerDetailData.success || sellerDetailData.data.id !== sellerUserId) {
      throw new Error(`Task 10 fail: ${JSON.stringify(sellerDetailData)}`);
    }
    console.log('✓ Task 10 Passed: Get seller detail');

    // --- Test Task 11: POST /api/admin/sellers/:id/ban ---
    console.log('--- Testing TASK 11: POST /api/admin/sellers/:id/ban ---');
    const banRes = await fetch(`${baseUrl}/api/admin/sellers/${sellerUserId}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ban_reason: 'Spamming products' })
    });
    console.log('Ban Status:', banRes.status);
    const banData = await banRes.json();
    if (banRes.status !== 200 || !banData.success || banData.data.status !== 'banned') {
      throw new Error(`Task 11 fail: ${JSON.stringify(banData)}`);
    }
    console.log('✓ Task 11 Passed: Ban seller');

    // --- Test Task 12: POST /api/admin/sellers/:id/unban ---
    console.log('--- Testing TASK 12: POST /api/admin/sellers/:id/unban ---');
    const unbanRes = await fetch(`${baseUrl}/api/admin/sellers/${sellerUserId}/unban`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Unban Status:', unbanRes.status);
    const unbanData = await unbanRes.json();
    if (unbanRes.status !== 200 || !unbanData.success || unbanData.data.status !== 'active') {
      throw new Error(`Task 12 fail: ${JSON.stringify(unbanData)}`);
    }
    console.log('✓ Task 12 Passed: Unban seller');

    // --- Test Task 13: GET /api/admin/orders ---
    console.log('--- Testing TASK 13: GET /api/admin/orders ---');
    const ordersRes = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Orders Status:', ordersRes.status);
    const ordersData = await ordersRes.json();
    if (ordersRes.status !== 200 || !ordersData.success || !Array.isArray(ordersData.data.orders)) {
      throw new Error(`Task 13 fail: ${JSON.stringify(ordersData)}`);
    }
    console.log('✓ Task 13 Passed: Get orders list');

    // --- Test Task 14: GET /api/admin/orders/:id ---
    console.log('--- Testing TASK 14: GET /api/admin/orders/:id ---');
    const orderDetailRes = await fetch(`${baseUrl}/api/admin/orders/ORD-TEST-99`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Order Detail Status:', orderDetailRes.status);
    const orderDetailData = await orderDetailRes.json();
    if (orderDetailRes.status !== 200 || !orderDetailData.success || orderDetailData.data.order_id !== 'ORD-TEST-99') {
      throw new Error(`Task 14 fail: ${JSON.stringify(orderDetailData)}`);
    }
    console.log('✓ Task 14 Passed: Get order details');

    // --- Test Task 15: PATCH /api/admin/orders/:id/status ---
    console.log('--- Testing TASK 15: PATCH /api/admin/orders/:id/status ---');
    const statusRes = await fetch(`${baseUrl}/api/admin/orders/ORD-TEST-99/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ new_status: 'in_transit' })
    });
    console.log('Override Status Code:', statusRes.status);
    const statusData = await statusRes.json();
    if (statusRes.status !== 200 || !statusData.success || statusData.data.new_status !== 'in_transit') {
      throw new Error(`Task 15 fail: ${JSON.stringify(statusData)}`);
    }
    console.log('✓ Task 15 Passed: Override order status');

    // --- Test Task 16: POST /api/admin/orders/:id/flag-refund ---
    console.log('--- Testing TASK 16: POST /api/admin/orders/:id/flag-refund ---');
    const flagRes = await fetch(`${baseUrl}/api/admin/orders/ORD-TEST-99/flag-refund`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Flag Status Code:', flagRes.status);
    const flagData = await flagRes.json();
    if (flagRes.status !== 200 || !flagData.success || !flagData.data.is_refund_flagged) {
      throw new Error(`Task 16 fail: ${JSON.stringify(flagData)}`);
    }
    console.log('✓ Task 16 Passed: Flag order for refund review');

    // --- Test Task 17: GET /api/admin/categories ---
    console.log('--- Testing TASK 17: GET /api/admin/categories ---');
    const catRes = await fetch(`${baseUrl}/api/admin/categories`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Categories Status Code:', catRes.status);
    const catData = await catRes.json();
    if (catRes.status !== 200 || !catData.success || !Array.isArray(catData.data.categories)) {
      throw new Error(`Task 17 fail: ${JSON.stringify(catData)}`);
    }
    console.log('✓ Task 17 Passed: Get categories list');

    // --- Test Task 18: POST /api/admin/categories ---
    console.log('--- Testing TASK 18: POST /api/admin/categories ---');
    const createCatRes = await fetch(`${baseUrl}/api/admin/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        emoji_icon: '🧶',
        display_name: 'Test Category',
        slug: 'test-category',
        description: 'Temporary testing category',
        sort_order: 10,
        is_active: true
      })
    });
    console.log('Create Category Status Code:', createCatRes.status);
    const createCatData = await createCatRes.json();
    if (createCatRes.status !== 201 || !createCatData.success || createCatData.data.slug !== 'test-category') {
      throw new Error(`Task 18 fail: ${JSON.stringify(createCatData)}`);
    }
    const newCatId = createCatData.data.id;
    console.log('✓ Task 18 Passed: Create new category');

    // --- Test Task 19: PATCH /api/admin/categories/:id ---
    console.log('--- Testing TASK 19: PATCH /api/admin/categories/:id ---');
    const updateCatRes = await fetch(`${baseUrl}/api/admin/categories/${newCatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ display_name: 'Updated Test Category' })
    });
    console.log('Update Category Status Code:', updateCatRes.status);
    const updateCatData = await updateCatRes.json();
    if (updateCatRes.status !== 200 || !updateCatData.success || updateCatData.data.display_name !== 'Updated Test Category') {
      throw new Error(`Task 19 fail: ${JSON.stringify(updateCatData)}`);
    }
    console.log('✓ Task 19 Passed: Update category');

    // --- Test Task 20: DELETE /api/admin/categories/:id ---
    console.log('--- Testing TASK 20: DELETE /api/admin/categories/:id ---');
    const deleteCatRes = await fetch(`${baseUrl}/api/admin/categories/${newCatId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Delete Category Status Code:', deleteCatRes.status);
    const deleteCatData = await deleteCatRes.json();
    if (deleteCatRes.status !== 200 || !deleteCatData.success) {
      throw new Error(`Task 20 fail: ${JSON.stringify(deleteCatData)}`);
    }
    console.log('✓ Task 20 Passed: Delete category');

    // --- Test Task 21: GET /api/admin/products ---
    console.log('--- Testing TASK 21: GET /api/admin/products ---');
    const productsRes = await fetch(`${baseUrl}/api/admin/products`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Products Status Code:', productsRes.status);
    const productsData = await productsRes.json();
    if (productsRes.status !== 200 || !productsData.success || !Array.isArray(productsData.data.products)) {
      throw new Error(`Task 21 fail: ${JSON.stringify(productsData)}`);
    }
    console.log('✓ Task 21 Passed: Get products list');

    // --- Test Task 22: PATCH /api/admin/products/:id/sponsored ---
    console.log('--- Testing TASK 22: PATCH /api/admin/products/:id/sponsored ---');
    const sponsorRes = await fetch(`${baseUrl}/api/admin/products/${productId}/sponsored`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ is_sponsored: true })
    });
    console.log('Sponsor Status Code:', sponsorRes.status);
    const sponsorData = await sponsorRes.json();
    if (sponsorRes.status !== 200 || !sponsorData.success || !sponsorData.data.is_sponsored) {
      throw new Error(`Task 22 fail: ${JSON.stringify(sponsorData)}`);
    }
    console.log('✓ Task 22 Passed: Toggle product sponsorship');

    // --- Test Task 23: GET /api/admin/audit-logs ---
    console.log('--- Testing TASK 23: GET /api/admin/audit-logs ---');
    const logsRes = await fetch(`${baseUrl}/api/admin/audit-logs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Audit Logs Status Code:', logsRes.status);
    const logsData = await logsRes.json();
    if (logsRes.status !== 200 || !logsData.success || !Array.isArray(logsData.data.logs)) {
      throw new Error(`Task 23 fail: ${JSON.stringify(logsData)}`);
    }
    const logId = logsData.data.logs[0].id;
    
    // Get diff
    const diffRes = await fetch(`${baseUrl}/api/admin/audit-logs/${logId}/diff`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Diff Status Code:', diffRes.status);
    const diffData = await diffRes.json();
    if (diffRes.status !== 200 || !diffData.success || diffData.data.id !== logId) {
      throw new Error(`Task 23 Diff fail: ${JSON.stringify(diffData)}`);
    }
    console.log('✓ Task 23 Passed: Get audit logs & diff');

    // --- Test Task 24: GET /api/admin/payment-health ---
    console.log('--- Testing TASK 24: GET /api/admin/payment-health ---');
    const healthRes = await fetch(`${baseUrl}/api/admin/payment-health`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Payment Health Status Code:', healthRes.status);
    const healthData = await healthRes.json();
    if (healthRes.status !== 200 || !healthData.success) {
      throw new Error(`Task 24 fail: ${JSON.stringify(healthData)}`);
    }
    console.log('✓ Task 24 Passed: Get payment health logs');

    // --- Test Task 25: POST /api/admin/payment-health/run-check ---
    console.log('--- Testing TASK 25: POST /api/admin/payment-health/run-check ---');
    const checkRes = await fetch(`${baseUrl}/api/admin/payment-health/run-check`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Run Check Status Code:', checkRes.status);
    const checkData = await checkRes.json();
    if (checkRes.status !== 200 || !checkData.success) {
      throw new Error(`Task 25 fail: ${JSON.stringify(checkData)}`);
    }
    console.log('✓ Task 25 Passed: Run payment health check');

    console.log('\n✅ ALL PART 2 API SMOKE TESTS PASSED');
  } catch (err) {
    console.error('❌ Smoke test failed:', err.stack);
    exitCode = 1;
  } finally {
    server.close(() => {
      console.log('Server shut down. Exiting with code:', exitCode);
      process.exit(exitCode);
    });
  }
}

// Wait for database connections to init, then start tests
setTimeout(runTests, 1000);
