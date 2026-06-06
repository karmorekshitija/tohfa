// test_task23.js — Task 23: Seller Profile GET/PUT /api/seller/profile
const http = require('http');
const db   = require('better-sqlite3')('tohfa.db');

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
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch (e) { resolve({ status: res.statusCode, body: d }); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let passed = 0, failed = 0;
function assert(label, cond, extra = '') {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra ? ': ' + extra : ''}`); failed++; }
}

async function run() {
  console.log('\n=== Task 23: GET/PUT /api/seller/profile ===\n');

  // Get seller
  const sellerUser = db.prepare(
    "SELECT u.email FROM users u JOIN seller_profiles s ON s.user_id = u.id WHERE u.role = 'seller' LIMIT 1"
  ).get();

  if (!sellerUser) { console.error('No seller in DB!'); process.exit(1); }
  console.log('  Using seller:', sellerUser.email);

  // Login
  const loginResp = await req('POST', '/api/auth/login', null, { email: sellerUser.email, password: 'password123' });
  assert('Seller login returns 200', loginResp.status === 200);
  const token = loginResp.body?.data?.access_token;
  assert('Access token obtained', !!token);
  if (!token) { console.error('Cannot proceed without token'); process.exit(1); }

  // ── Test 1: GET /api/seller/profile ──
  console.log('\n  [GET /api/seller/profile]');
  const getResp = await req('GET', '/api/seller/profile', token, null);
  assert('GET returns 200', getResp.status === 200, `got ${getResp.status}`);

  const d = getResp.body?.data;
  assert('Response has data object', !!d);
  assert('display_name field present', 'display_name' in (d || {}));
  assert('bio field present', 'bio' in (d || {}));
  assert('location field present', 'location' in (d || {}));
  assert('website field present', 'website' in (d || {}));
  assert('is_accepting_orders is boolean', typeof d?.is_accepting_orders === 'boolean');
  assert('default_language present', typeof d?.default_language === 'string');
  assert('store_currency present', typeof d?.store_currency === 'string');
  assert('notifications object present', typeof d?.notifications === 'object');

  // ── Test 2: PUT /api/seller/profile — update display_name ──
  console.log('\n  [PUT /api/seller/profile]');
  const updateBody = {
    display_name: 'Test Studio Updated',
    bio: 'Updated bio from test script',
    location: 'Mumbai, India',
    website: 'www.teststudio.in',
    is_accepting_orders: true,
    default_language: 'en',
    store_currency: 'INR'
  };

  const putResp = await req('PUT', '/api/seller/profile', token, updateBody);
  assert('PUT returns 200', putResp.status === 200, `got ${putResp.status} — ${JSON.stringify(putResp.body).substring(0,200)}`);

  const updatedData = putResp.body?.data;
  assert('Updated data returned', !!updatedData);
  assert('display_name updated', updatedData?.display_name === 'Test Studio Updated', `got "${updatedData?.display_name}"`);
  assert('bio updated', updatedData?.bio === 'Updated bio from test script', `got "${updatedData?.bio}"`);
  assert('location updated', updatedData?.location === 'Mumbai, India', `got "${updatedData?.location}"`);

  // ── Test 3: Invalid handle rejected ──
  console.log('\n  [PUT — invalid handle]');
  const badHandleResp = await req('PUT', '/api/seller/profile', token, { handle: 'INVALID HANDLE!!' });
  assert('Invalid handle returns 400', badHandleResp.status === 400, `got ${badHandleResp.status}`);

  // ── Test 4: Unauthenticated request ──
  console.log('\n  [Auth guards]');
  const unauthResp = await req('GET', '/api/seller/profile', null, null);
  assert('Unauthenticated GET returns 401', unauthResp.status === 401);

  const unauthPutResp = await req('PUT', '/api/seller/profile', null, { display_name: 'hacker' });
  assert('Unauthenticated PUT returns 401', unauthPutResp.status === 401);

  // ── Summary ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
