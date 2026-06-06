// test_task33.js — Task 33: Admin Sellers (List, Detail, Ban/Unban)
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
  console.log('\n=== Task 33: Admin Sellers ===\n');

  // Clean up and seed admin and test seller
  db.prepare("PRAGMA foreign_keys = OFF").run();
  db.prepare("DELETE FROM admin_users WHERE username = 'admin_test'").run();
  db.prepare("DELETE FROM users WHERE email = 'test_seller_task33@test.com'").run();
  db.prepare("DELETE FROM seller_profiles WHERE handle = 'task_33_seller'").run();
  db.prepare("PRAGMA foreign_keys = ON").run();

  const hash = bcrypt.hashSync('password123', 10);
  db.prepare(`
    INSERT INTO admin_users (username, email, password_hash, display_name, role, is_active)
    VALUES ('admin_test', 'admin_test@test.com', ?, 'Test Admin', 'super_admin', 1)
  `).run(hash);

  const adminId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role, is_banned)
    VALUES ('test_seller_task33@test.com', ?, 'Task 33 Seller', 'seller', 0)
  `).run(hash);
  const sellerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  db.prepare(`
    DELETE FROM seller_profiles WHERE user_id = ?
  `).run(sellerId);
  db.prepare(`
    INSERT INTO seller_profiles (user_id, display_name, handle, shop_name, is_accepting_orders)
    VALUES (?, 'Task 33 Seller Studio', 'task_33_seller', 'Task 33 Shop', 1)
  `).run(sellerId);

  // Clean up any old bans
  db.prepare("DELETE FROM seller_bans WHERE seller_id = ?").run(sellerId);

  // 1. Login to get token
  console.log('  [1. Login]');
  const loginResp = await req('POST', '/api/admin/auth/login', null, { username: 'admin_test', password: 'password123' });
  assert('Login status is 200', loginResp.status === 200);
  const token = loginResp.body?.data?.access_token;
  assert('Has access_token', !!token);

  // 2. GET /api/admin/sellers
  console.log('\n  [2. GET /api/admin/sellers]');
  const sellersResp = await req('GET', '/api/admin/sellers', token);
  assert('GET sellers returns 200', sellersResp.status === 200);
  assert('Response is success', sellersResp.body?.success === true);
  const sellersList = sellersResp.body?.data?.sellers || [];
  const testSeller = sellersList.find(s => s.id === sellerId);
  assert('Sellers list contains our test seller', !!testSeller);
  assert('Seller has correct display name', testSeller?.display_name === 'Task 33 Seller Studio');
  assert('Seller status is active', testSeller?.status === 'active');

  // 3. GET /api/admin/sellers/:id
  console.log('\n  [3. GET /api/admin/sellers/:id]');
  const detailResp = await req('GET', `/api/admin/sellers/${sellerId}`, token);
  assert('GET seller detail returns 200', detailResp.status === 200);
  assert('Detail matches seller ID', detailResp.body?.data?.id === sellerId);
  assert('Detail has status active', detailResp.body?.data?.status === 'active');

  // 4. POST /api/admin/sellers/:id/ban
  console.log('\n  [4. POST /api/admin/sellers/:id/ban]');
  const banResp = await req('POST', `/api/admin/sellers/${sellerId}/ban`, token, { ban_reason: 'Testing ban function' });
  assert('POST ban returns 200', banResp.status === 200);
  assert('Response returns status banned', banResp.body?.data?.status === 'banned');

  // Verify DB state is banned
  const userRowBanned = db.prepare("SELECT is_banned FROM users WHERE id = ?").get(sellerId);
  assert('User table has is_banned = 1', userRowBanned?.is_banned === 1);
  const activeBan = db.prepare("SELECT 1 FROM seller_bans WHERE seller_id = ? AND unbanned_at IS NULL").get(sellerId);
  assert('Has active ban entry in seller_bans', !!activeBan);

  // Verify detail endpoint reports banned
  const detailRespBanned = await req('GET', `/api/admin/sellers/${sellerId}`, token);
  assert('Banned seller detail reports banned status', detailRespBanned.body?.data?.status === 'banned');

  // 5. POST /api/admin/sellers/:id/unban
  console.log('\n  [5. POST /api/admin/sellers/:id/unban]');
  const unbanResp = await req('POST', `/api/admin/sellers/${sellerId}/unban`, token);
  assert('POST unban returns 200', unbanResp.status === 200);
  assert('Response returns status active', unbanResp.body?.data?.status === 'active');

  // Verify DB state is active
  const userRowActive = db.prepare("SELECT is_banned FROM users WHERE id = ?").get(sellerId);
  assert('User table has is_banned = 0', userRowActive?.is_banned === 0);
  const activeBanAfter = db.prepare("SELECT 1 FROM seller_bans WHERE seller_id = ? AND unbanned_at IS NULL").get(sellerId);
  assert('Has no active ban entry in seller_bans', !activeBanAfter);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
