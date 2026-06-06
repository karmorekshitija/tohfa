// test_task35.js — Task 35: Admin Categories (List, Create, Edit, Delete)
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
  console.log('\n=== Task 35: Admin Categories ===\n');

  // Clean up and seed database
  db.prepare("PRAGMA foreign_keys = OFF").run();
  db.prepare("DELETE FROM admin_users WHERE username = 'admin_test'").run();
  db.prepare("DELETE FROM categories WHERE slug IN ('test-category-slug', 'test-category-updated', 'test-has-products')").run();
  db.prepare("DELETE FROM products WHERE name = 'Task 35 Product'").run();
  db.prepare("DELETE FROM users WHERE email = 'test_seller_task35@test.com'").run();
  db.prepare("PRAGMA foreign_keys = ON").run();

  const hash = bcrypt.hashSync('password123', 10);
  db.prepare(`
    INSERT INTO admin_users (username, email, password_hash, display_name, role, is_active)
    VALUES ('admin_test', 'admin_test@test.com', ?, 'Test Admin', 'super_admin', 1)
  `).run(hash);

  // Create a category with a product to test delete block
  db.prepare(`
    INSERT INTO categories (display_name, name, slug, emoji_icon, icon_emoji, description, sort_order, is_active, product_count, updated_at)
    VALUES ('Has Products Category', 'Has Products Category', 'test-has-products', '🎨', '🎨', 'Description', 1, 1, 1, datetime('now'))
  `).run();
  const hasProductsCatId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role, is_banned)
    VALUES ('test_seller_task35@test.com', ?, 'Task 35 Seller', 'seller', 0)
  `).run(hash);
  const sellerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  db.prepare(`
    INSERT INTO products (seller_id, category_id, name, price_paise, stock_qty, status)
    VALUES (?, ?, 'Task 35 Product', 250000, 5, 'active')
  `).run(sellerId, hasProductsCatId);

  // 1. Login to get token
  console.log('  [1. Login]');
  const loginResp = await req('POST', '/api/admin/auth/login', null, { username: 'admin_test', password: 'password123' });
  assert('Login status is 200', loginResp.status === 200);
  const token = loginResp.body?.data?.access_token;
  assert('Has access_token', !!token);

  // 2. GET /api/admin/categories
  console.log('\n  [2. GET /api/admin/categories]');
  const getResp = await req('GET', '/api/admin/categories', token);
  assert('GET categories returns 200', getResp.status === 200);
  assert('Response is success', getResp.body?.success === true);
  const categoriesList = getResp.body?.data?.categories || [];
  assert('Categories list has elements', categoriesList.length > 0);
  const foundHasProducts = categoriesList.find(c => c.slug === 'test-has-products');
  assert('Found test-has-products category', !!foundHasProducts);

  // 3. POST /api/admin/categories (Create new category)
  console.log('\n  [3. POST /api/admin/categories]');
  const newCatBody = {
    emoji_icon: '🧶',
    display_name: 'Test Category',
    slug: 'test-category-slug',
    description: 'Test category description',
    sort_order: 10,
    is_active: true
  };
  const postResp = await req('POST', '/api/admin/categories', token, newCatBody);
  assert('POST category returns 201', postResp.status === 201);
  assert('Returned category name matches', postResp.body?.data?.display_name === 'Test Category');
  assert('Returned category slug matches', postResp.body?.data?.slug === 'test-category-slug');
  assert('Returned category emoji matches', postResp.body?.data?.emoji_icon === '🧶');
  assert('Returned category is_active is true', postResp.body?.data?.is_active === true);
  const newCatId = postResp.body?.data?.id;
  assert('New category ID is defined', !!newCatId);

  // 4. POST duplicate slug check (returns 409)
  console.log('\n  [4. POST Duplicate Slug Check]');
  const dupResp = await req('POST', '/api/admin/categories', token, newCatBody);
  assert('POST duplicate slug returns 409', dupResp.status === 409);
  assert('Error code is SLUG_CONFLICT', dupResp.body?.code === 'SLUG_CONFLICT');

  // 5. PATCH /api/admin/categories/:id (Update category)
  console.log('\n  [5. PATCH /api/admin/categories/:id]');
  const updateBody = {
    emoji_icon: '🧸',
    display_name: 'Updated Category Name',
    slug: 'test-category-updated',
    description: 'Updated description',
    sort_order: 20,
    is_active: false
  };
  const patchResp = await req('PATCH', `/api/admin/categories/${newCatId}`, token, updateBody);
  assert('PATCH category returns 200', patchResp.status === 200);
  assert('Updated category display_name matches', patchResp.body?.data?.display_name === 'Updated Category Name');
  assert('Updated category slug matches', patchResp.body?.data?.slug === 'test-category-updated');
  assert('Updated category emoji matches', patchResp.body?.data?.emoji_icon === '🧸');
  assert('Updated category is_active is false', patchResp.body?.data?.is_active === false);

  // Verify in DB
  const dbCat = db.prepare("SELECT * FROM categories WHERE id = ?").get(newCatId);
  assert('DB row exists', !!dbCat);
  assert('DB display_name matches', dbCat.display_name === 'Updated Category Name');
  assert('DB slug matches', dbCat.slug === 'test-category-updated');
  assert('DB is_active matches (0)', dbCat.is_active === 0);

  // 6. DELETE /api/admin/categories/:id block due to active products (returns 400)
  console.log('\n  [6. DELETE Category with Active Products]');
  const deleteBlockResp = await req('DELETE', `/api/admin/categories/${hasProductsCatId}`, token);
  assert('DELETE category with products returns 400', deleteBlockResp.status === 400);
  assert('Error code is HAS_ACTIVE_PRODUCTS', deleteBlockResp.body?.code === 'HAS_ACTIVE_PRODUCTS');

  // 7. DELETE /api/admin/categories/:id (Delete category)
  console.log('\n  [7. DELETE /api/admin/categories/:id]');
  const deleteResp = await req('DELETE', `/api/admin/categories/${newCatId}`, token);
  assert('DELETE category returns 200', deleteResp.status === 200);
  assert('Response deleted_id matches', deleteResp.body?.data?.deleted_id === newCatId);

  // Verify not in DB
  const deletedCat = db.prepare("SELECT id FROM categories WHERE id = ?").get(newCatId);
  assert('Category is deleted from DB', !deletedCat);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
