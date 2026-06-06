// test_task36.js — Task 36: Admin Products (List, Toggle Sponsored)
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
  console.log('\n=== Task 36: Admin Products ===\n');

  // Clean up and seed database
  db.prepare("PRAGMA foreign_keys = OFF").run();
  db.prepare("DELETE FROM admin_users WHERE username = 'admin_test'").run();
  db.prepare("DELETE FROM users WHERE email = 'test_seller_task36@test.com'").run();
  db.prepare("DELETE FROM categories WHERE slug = 'test-category-task36'").run();
  db.prepare("DELETE FROM products WHERE name IN ('Task 36 Sponsored Product', 'Task 36 Non-Sponsored Product')").run();
  db.prepare("DELETE FROM sponsored_products WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'Task 36 %')").run();
  db.prepare("PRAGMA foreign_keys = ON").run();

  const hash = bcrypt.hashSync('password123', 10);
  db.prepare(`
    INSERT INTO admin_users (username, email, password_hash, display_name, role, is_active)
    VALUES ('admin_test', 'admin_test@test.com', ?, 'Test Admin', 'super_admin', 1)
  `).run(hash);

  db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role, is_banned)
    VALUES ('test_seller_task36@test.com', ?, 'Task 36 Seller', 'seller', 0)
  `).run(hash);
  const sellerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  db.prepare(`
    INSERT INTO categories (display_name, name, slug, emoji_icon, icon_emoji, description, sort_order, is_active, product_count, updated_at)
    VALUES ('Task 36 Category', 'Task 36 Category', 'test-category-task36', '🎨', '🎨', 'Description', 1, 1, 0, datetime('now'))
  `).run();
  const categoryId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  db.prepare(`
    INSERT INTO products (seller_id, category_id, name, price_paise, stock_qty, status)
    VALUES (?, ?, 'Task 36 Sponsored Product', 120000, 10, 'active')
  `).run(sellerId, categoryId);
  const sponsoredProdId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  db.prepare(`
    INSERT INTO products (seller_id, category_id, name, price_paise, stock_qty, status)
    VALUES (?, ?, 'Task 36 Non-Sponsored Product', 85000, 5, 'active')
  `).run(sellerId, categoryId);
  const nonSponsoredProdId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  // Insert active sponsored product entry in DB directly
  db.prepare(`
    INSERT INTO sponsored_products (product_id, is_sponsored, sponsored_at, sponsored_by, updated_at)
    VALUES (?, 1, datetime('now'), 1, datetime('now'))
  `).run(sponsoredProdId);

  // 1. Login to get token
  console.log('  [1. Login]');
  const loginResp = await req('POST', '/api/admin/auth/login', null, { username: 'admin_test', password: 'password123' });
  assert('Login status is 200', loginResp.status === 200);
  const token = loginResp.body?.data?.access_token;
  assert('Has access_token', !!token);

  // 2. GET /api/admin/products (filter = all)
  console.log('\n  [2. GET /api/admin/products (filter=all)]');
  const getResp = await req('GET', '/api/admin/products?filter=all', token);
  assert('GET products returns 200', getResp.status === 200);
  const products = getResp.body?.data?.products || [];
  assert('Has products listed', products.length >= 2);
  const p1 = products.find(p => p.id === sponsoredProdId);
  const p2 = products.find(p => p.id === nonSponsoredProdId);
  assert('Found sponsored product in all list', !!p1);
  assert('Product 1 is_sponsored is true', p1?.is_sponsored === true);
  assert('Product 1 status label is Sponsored', p1?.sponsored_status_label === 'Sponsored');
  assert('Found non-sponsored product in all list', !!p2);
  assert('Product 2 is_sponsored is false', p2?.is_sponsored === false);
  assert('Product 2 status label is —', p2?.sponsored_status_label === '—');

  // 3. GET /api/admin/products (filter = sponsored)
  console.log('\n  [3. GET /api/admin/products (filter=sponsored)]');
  const getSponsResp = await req('GET', '/api/admin/products?filter=sponsored', token);
  assert('GET sponsored products returns 200', getSponsResp.status === 200);
  const sponsoredProducts = getSponsResp.body?.data?.products || [];
  const p1Spons = sponsoredProducts.find(p => p.id === sponsoredProdId);
  const p2Spons = sponsoredProducts.find(p => p.id === nonSponsoredProdId);
  assert('Found sponsored product in filtered list', !!p1Spons);
  assert('Did NOT find non-sponsored product in filtered list', !p2Spons);

  // 4. PATCH /api/admin/products/:id/sponsored (Make sponsored prod non-sponsored)
  console.log('\n  [4. PATCH /api/admin/products/:id/sponsored - toggle off]');
  const patchOffResp = await req('PATCH', `/api/admin/products/${sponsoredProdId}/sponsored`, token, { is_sponsored: false });
  assert('PATCH sponsored returns 200', patchOffResp.status === 200);
  assert('Response reports is_sponsored = false', patchOffResp.body?.data?.is_sponsored === false);
  assert('Response status label is —', patchOffResp.body?.data?.sponsored_status_label === '—');

  // Check in DB
  const dbSponsRowOff = db.prepare('SELECT is_sponsored FROM sponsored_products WHERE product_id = ?').get(sponsoredProdId);
  assert('DB record has is_sponsored = 0', dbSponsRowOff?.is_sponsored === 0);

  // 5. PATCH /api/admin/products/:id/sponsored (Make non-sponsored prod sponsored)
  console.log('\n  [5. PATCH /api/admin/products/:id/sponsored - toggle on]');
  const patchOnResp = await req('PATCH', `/api/admin/products/${nonSponsoredProdId}/sponsored`, token, { is_sponsored: true });
  assert('PATCH sponsored returns 200', patchOnResp.status === 200);
  assert('Response reports is_sponsored = true', patchOnResp.body?.data?.is_sponsored === true);
  assert('Response status label is Sponsored', patchOnResp.body?.data?.sponsored_status_label === 'Sponsored');

  // Check in DB
  const dbSponsRowOn = db.prepare('SELECT is_sponsored FROM sponsored_products WHERE product_id = ?').get(nonSponsoredProdId);
  assert('DB record has is_sponsored = 1', dbSponsRowOn?.is_sponsored === 1);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
