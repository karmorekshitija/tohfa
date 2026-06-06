// test_task34.js — Task 34: Admin Orders (List, Detail, Update Status, Flag Refund)
const http = require('http');
const db   = require('better-sqlite3')('tohfa.db');
const bcrypt = require('bcrypt');

function req(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 5000, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d) });
        } catch(e) {
          resolve({ status: res.statusCode, body: d });
        }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let passed = 0, failed = 0;
function assert(label, cond, extra='') {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${extra ? ': ' + extra : ''}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== Task 34: Admin Orders ===\n');

  // Clean up and seed database
  db.prepare("PRAGMA foreign_keys = OFF").run();
  db.prepare("DELETE FROM admin_users WHERE username = 'admin_test'").run();
  db.prepare("DELETE FROM users WHERE email IN ('test_buyer_task34@test.com', 'test_seller_task34@test.com')").run();
  db.prepare("DELETE FROM seller_profiles WHERE handle = 'task_34_seller'").run();
  db.prepare("DELETE FROM products WHERE name = 'Task 34 Product'").run();
  db.prepare("DELETE FROM orders WHERE order_ref = 'ORD-TASK34-99'").run();
  db.prepare("DELETE FROM order_items WHERE product_name = 'Task 34 Product'").run();
  db.prepare("DELETE FROM order_flags WHERE order_id = 'ORD-TASK34-99'").run();
  db.prepare("PRAGMA foreign_keys = ON").run();

  const hash = bcrypt.hashSync('password123', 10);
  db.prepare(`
    INSERT INTO admin_users (username, email, password_hash, display_name, role, is_active)
    VALUES ('admin_test', 'admin_test@test.com', ?, 'Test Admin', 'super_admin', 1)
  `).run(hash);

  db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role, is_banned)
    VALUES ('test_buyer_task34@test.com', ?, 'Task 34 Buyer', 'buyer', 0)
  `).run(hash);
  const buyerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role, is_banned)
    VALUES ('test_seller_task34@test.com', ?, 'Task 34 Seller', 'seller', 0)
  `).run(hash);
  const sellerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  db.prepare(`
    INSERT INTO seller_profiles (user_id, display_name, handle, shop_name, is_accepting_orders)
    VALUES (?, 'Task 34 Seller Studio', 'task_34_seller', 'Task 34 Shop', 1)
  `).run(sellerId);
  const sellerProfileId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  db.prepare(`
    INSERT INTO products (seller_id, name, price_paise, stock_qty, status)
    VALUES (?, 'Task 34 Product', 250000, 5, 'active')
  `).run(sellerId);
  const productId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  db.prepare(`
    INSERT INTO orders (id, order_ref, buyer_id, subtotal_paise, total_paise, status)
    VALUES (9999, 'ORD-TASK34-99', ?, 250000, 250000, 'awaiting payment')
  `).run(buyerId);

  db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, unit_price_paise, quantity)
    VALUES (9999, ?, 'Task 34 Product', 250000, 1)
  `).run(productId);

  // 1. Login to get token
  console.log('  [1. Login]');
  const loginResp = await req('POST', '/api/admin/auth/login', null, { username: 'admin_test', password: 'password123' });
  assert('Login status is 200', loginResp.status === 200);
  const token = loginResp.body?.data?.access_token;
  assert('Has access_token', !!token);

  // 2. GET /api/admin/orders
  console.log('\n  [2. GET /api/admin/orders]');
  const ordersResp = await req('GET', '/api/admin/orders', token);
  assert('GET orders returns 200', ordersResp.status === 200);
  assert('Response is success', ordersResp.body?.success === true);
  const ordersList = ordersResp.body?.data?.orders || [];
  const testOrder = ordersList.find(o => o.order_id === 'ORD-TASK34-99');
  assert('Orders list contains our test order', !!testOrder);
  assert('Order has correct buyer name', testOrder?.buyer_name === 'Task 34 Buyer');
  assert('Order has correct seller name', testOrder?.seller_name === 'Task 34 Shop');
  assert('Order status matches', testOrder?.status === 'awaiting_payment');

  // 3. GET /api/admin/orders/:id
  console.log('\n  [3. GET /api/admin/orders/:id]');
  const detailResp = await req('GET', '/api/admin/orders/ORD-TASK34-99', token);
  assert('GET order detail returns 200', detailResp.status === 200);
  assert('Detail matches order ID', detailResp.body?.data?.order_id === 'ORD-TASK34-99');
  assert('Detail has status', detailResp.body?.data?.status === 'awaiting payment');
  assert('Detail has total amount', detailResp.body?.data?.total_paise === 250000);
  assert('Detail has buyer email', detailResp.body?.data?.buyer?.email === 'test_buyer_task34@test.com');
  assert('Detail has seller shop name', detailResp.body?.data?.seller?.shop_name === 'Task 34 Shop');
  assert('Detail has line items count', detailResp.body?.data?.line_items?.length === 1);

  // 4. PATCH /api/admin/orders/:id/status
  console.log('\n  [4. PATCH /api/admin/orders/:id/status]');
  const statusResp = await req('PATCH', '/api/admin/orders/ORD-TASK34-99/status', token, { new_status: 'processing' });
  assert('PATCH status returns 200', statusResp.status === 200);
  assert('Response reports new status processing', statusResp.body?.data?.new_status === 'processing');

  // Verify DB state is processing
  const dbOrder = db.prepare("SELECT status FROM orders WHERE order_ref = 'ORD-TASK34-99'").get();
  assert('Orders table updated status', dbOrder?.status === 'processing');

  // 5. POST /api/admin/orders/:id/flag-refund
  console.log('\n  [5. POST /api/admin/orders/:id/flag-refund]');
  const flagResp = await req('POST', '/api/admin/orders/ORD-TASK34-99/flag-refund', token);
  assert('POST flag-refund returns 200', flagResp.status === 200);
  assert('Response returns is_refund_flagged = true', flagResp.body?.data?.is_refund_flagged === true);

  // Verify DB state is flagged
  const activeFlag = db.prepare("SELECT 1 FROM order_flags WHERE order_id = 'ORD-TASK34-99' AND resolved_at IS NULL").get();
  assert('Has active refund review flag', !!activeFlag);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
