// test_task24.js — Task 24: Seller Listings CRUD
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
  console.log('\n=== Task 24: Seller Listings CRUD ===\n');

  // Login
  const sellerUser = db.prepare(
    "SELECT u.email FROM users u JOIN seller_profiles s ON s.user_id = u.id WHERE u.role = 'seller' LIMIT 1"
  ).get();
  if (!sellerUser) { console.error('No seller in DB'); process.exit(1); }
  console.log('  Using seller:', sellerUser.email);

  const loginResp = await req('POST', '/api/auth/login', null, { email: sellerUser.email, password: 'password123' });
  assert('Login returns 200', loginResp.status === 200);
  const token = loginResp.body?.data?.access_token;
  assert('Token obtained', !!token);
  if (!token) { console.error('Cannot continue'); process.exit(1); }

  // ── GET /api/seller/listings (all) ──
  console.log('\n  [GET /api/seller/listings]');
  const listResp = await req('GET', '/api/seller/listings', token, null);
  assert('GET listings returns 200', listResp.status === 200, `got ${listResp.status}`);
  const ld = listResp.body?.data;
  assert('Response has data object', !!ld);
  assert('listings is array', Array.isArray(ld?.listings), `got ${typeof ld?.listings}`);
  assert('total is number', typeof ld?.total === 'number');
  assert('low_stock_count present', typeof ld?.low_stock_count === 'number');

  // ── GET with status filter ──
  const draftResp = await req('GET', '/api/seller/listings?status=draft', token, null);
  assert('Filter by status=draft returns 200', draftResp.status === 200);

  // ── GET with search ──
  const searchResp = await req('GET', '/api/seller/listings?search=ceramic', token, null);
  assert('Search query returns 200', searchResp.status === 200);

  // ── POST /api/seller/listings — create ──
  console.log('\n  [POST /api/seller/listings]');
  const createBody = {
    title: 'Test Listing for Task 24',
    price_paise: 149900, // ₹1499
    stock_count: 5,
    category: 'ceramics-pottery',
    description: 'A test listing for automated testing.',
    status: 'draft',
    tags: ['handmade', 'ceramic'],
    processing_time: '3-5 days'
  };

  const createResp = await req('POST', '/api/seller/listings', token, createBody);
  assert('POST listings returns 201', createResp.status === 201, `got ${createResp.status} — ${JSON.stringify(createResp.body).substring(0,200)}`);
  const newListing = createResp.body?.data;
  assert('New listing has listing_id', !!newListing?.listing_id);
  assert('New listing status is draft', newListing?.status === 'draft');

  const listingId = newListing?.listing_id;

  // ── GET /api/seller/listings/:id ──
  console.log('\n  [GET /api/seller/listings/:id]');
  const getOneResp = await req('GET', `/api/seller/listings/${listingId}`, token, null);
  assert('GET single listing returns 200', getOneResp.status === 200, `got ${getOneResp.status}`);
  const oneData = getOneResp.body?.data;
  assert('Listing title matches', oneData?.title === 'Test Listing for Task 24', `got "${oneData?.title}"`);
  assert('Listing price correct', oneData?.price_paise === 149900, `got ${oneData?.price_paise}`);

  // ── PUT /api/seller/listings/:id — update ──
  console.log('\n  [PUT /api/seller/listings/:id]');
  const updateResp = await req('PUT', `/api/seller/listings/${listingId}`, token, {
    title: 'Updated Test Listing',
    price_paise: 199900,
    status: 'active',
    stock_count: 3
  });
  assert('PUT listing returns 200', updateResp.status === 200, `got ${updateResp.status}`);
  const updatedData = updateResp.body?.data;
  assert('Updated title matches', updatedData?.title === 'Updated Test Listing', `got "${updatedData?.title}"`);
  assert('Updated price matches', updatedData?.price_paise === 199900, `got ${updatedData?.price_paise}`);
  assert('Status updated to active', updatedData?.status === 'active', `got "${updatedData?.status}"`);

  // ── DELETE /api/seller/listings/:id ──
  console.log('\n  [DELETE /api/seller/listings/:id]');
  const deleteResp = await req('DELETE', `/api/seller/listings/${listingId}`, token, null);
  assert('DELETE listing returns 200', deleteResp.status === 200, `got ${deleteResp.status}`);
  assert('Deleted status in response', deleteResp.body?.data?.status === 'deleted', `got "${deleteResp.body?.data?.status}"`);

  // Verify deleted listing no longer shows in listing list
  const afterDeleteResp = await req('GET', `/api/seller/listings?status=all`, token, null);
  const stillThere = afterDeleteResp.body?.data?.listings?.some(l => l.listing_id === listingId);
  assert('Deleted listing not in list', !stillThere);

  // ── POST — missing required fields ──
  console.log('\n  [Validation]');
  const missingResp = await req('POST', '/api/seller/listings', token, { title: 'Incomplete Listing' });
  assert('Missing required fields returns 400', missingResp.status === 400, `got ${missingResp.status}`);

  // ── Auth guard ──
  console.log('\n  [Auth guards]');
  const unauthListResp = await req('GET', '/api/seller/listings', null, null);
  assert('Unauthenticated GET returns 401', unauthListResp.status === 401);

  const unauthPostResp = await req('POST', '/api/seller/listings', null, createBody);
  assert('Unauthenticated POST returns 401', unauthPostResp.status === 401);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
