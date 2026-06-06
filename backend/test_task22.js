// test_task22.js — Task 22: Seller Dashboard GET /api/seller/dashboard
const http = require('http');
const db   = require('better-sqlite3')('tohfa.db');

function postJSON(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 5000, path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJSON(path, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 5000, path,
      method: 'GET',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch (e) { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

let passed = 0, failed = 0;
function assert(label, condition, extra = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${extra ? ': ' + extra : ''}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== Task 22: GET /api/seller/dashboard ===\n');

  // ── Test 1: unauthenticated request returns 401 ──
  const unauthResp = await getJSON('/api/seller/dashboard', null);
  assert('Unauthenticated request returns 401', unauthResp.status === 401, `got ${unauthResp.status}`);

  // ── Find a seller account ──
  const sellerUser = db.prepare(
    "SELECT u.email FROM users u JOIN seller_profiles s ON s.user_id = u.id WHERE u.role = 'seller' LIMIT 1"
  ).get();

  if (!sellerUser) {
    console.log('  ⚠ No seller in DB — creating one for test...');
    // Register a test seller
    const regResp = await postJSON('/api/auth/register/seller', {
      email: 'testseller_task22@tohfa.test',
      password: 'password123',
      full_name: 'Test Seller',
      shop_name: 'Test Studio',
      phone: '9000000022'
    });
    assert('Seller registration succeeded (200 or 201)', [200, 201].includes(regResp.status), `got ${regResp.status} — ${JSON.stringify(regResp.body).substring(0,200)}`);
    if (![200, 201].includes(regResp.status)) {
      console.error('\nSetup failed — cannot proceed.\n');
      process.exit(1);
    }
    sellerUser = { email: 'testseller_task22@tohfa.test' };
  }

  console.log(`  Using seller: ${sellerUser.email}`);

  // ── Login ──
  const loginResp = await postJSON('/api/auth/login', {
    email: sellerUser.email,
    password: 'password123'
  });
  assert('Seller login returns 200', loginResp.status === 200, `got ${loginResp.status}`);
  const token = loginResp.body?.data?.access_token;
  assert('Access token present', !!token);

  if (!token) {
    console.error('\nCannot continue without token.\n');
    process.exit(1);
  }

  // ── Test 2: GET /api/seller/dashboard with valid seller token ──
  const dashResp = await getJSON('/api/seller/dashboard', token);
  assert('Dashboard returns 200', dashResp.status === 200, `got ${dashResp.status} — ${JSON.stringify(dashResp.body).substring(0,300)}`);

  const d = dashResp.body?.data;
  assert('Response has data object', !!d);

  // ── Test 3: Response shape ──
  assert('seller.display_name present', typeof d?.seller?.display_name === 'string' || d?.seller?.display_name == null);
  assert('date_label present', typeof d?.date_label === 'string', `got ${typeof d?.date_label}`);
  assert('period present', typeof d?.period === 'string', `got ${typeof d?.period}`);

  assert('kpis.order_value_paise is number', typeof d?.kpis?.order_value_paise === 'number', `got ${typeof d?.kpis?.order_value_paise}`);
  assert('kpis.total_orders is number', typeof d?.kpis?.total_orders === 'number', `got ${typeof d?.kpis?.total_orders}`);

  assert('low_stock_alerts is array', Array.isArray(d?.low_stock_alerts), `got ${typeof d?.low_stock_alerts}`);
  assert('recent_orders is array', Array.isArray(d?.recent_orders), `got ${typeof d?.recent_orders}`);
  assert('announcements is array', Array.isArray(d?.announcements), `got ${typeof d?.announcements}`);

  // ── Test 4: period param ──
  const dash30 = await getJSON('/api/seller/dashboard?period=30d', token);
  assert('Period=30d returns 200', dash30.status === 200, `got ${dash30.status}`);
  assert('Period param reflected in response', dash30.body?.data?.period === '30d', `got ${dash30.body?.data?.period}`);

  // ── Test 5: buyer cannot access seller dashboard ──
  const buyerUser = db.prepare(
    "SELECT email FROM users WHERE role = 'buyer' LIMIT 1"
  ).get();

  if (buyerUser) {
    const buyerLogin = await postJSON('/api/auth/login', { email: buyerUser.email, password: 'password123' });
    if (buyerLogin.status === 200) {
      const buyerToken = buyerLogin.body?.data?.access_token;
      const buyerDash = await getJSON('/api/seller/dashboard', buyerToken);
      assert('Buyer gets 403 on seller dashboard', buyerDash.status === 403, `got ${buyerDash.status}`);
    } else {
      console.log('  ⚠ Could not login as buyer — skipping role guard test');
    }
  } else {
    console.log('  ⚠ No buyer in DB — skipping role guard test');
  }

  // ── Summary ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
