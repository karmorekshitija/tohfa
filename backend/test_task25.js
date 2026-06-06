// test_task25.js — Task 25: Seller Orders
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
  console.log('\n=== Task 25: Seller Orders ===\n');

  // Login
  const sellerUser = db.prepare(
    "SELECT u.email FROM users u JOIN seller_profiles s ON s.user_id = u.id WHERE u.role = 'seller' LIMIT 1"
  ).get();
  if (!sellerUser) { console.error('No seller found'); process.exit(1); }
  console.log('  Using seller:', sellerUser.email);

  const loginResp = await req('POST', '/api/auth/login', null, { email: sellerUser.email, password: 'password123' });
  assert('Login returns 200', loginResp.status === 200);
  const token = loginResp.body?.data?.access_token;
  assert('Token obtained', !!token);
  if (!token) process.exit(1);

  // ── GET /api/seller/orders ──
  console.log('\n  [GET /api/seller/orders]');
  const listResp = await req('GET', '/api/seller/orders', token, null);
  assert('GET orders returns 200', listResp.status === 200, `got ${listResp.status}`);
  const d = listResp.body?.data;
  assert('Response has data', !!d);
  assert('orders is array', Array.isArray(d?.orders));
  assert('total is number', typeof d?.total === 'number');
  assert('pending_action_count present', typeof d?.pending_action_count === 'number');
  assert('on_time_rate_pct present', typeof d?.on_time_rate_pct === 'number');

  // Period filter
  const period90 = await req('GET', '/api/seller/orders?period=90d', token, null);
  assert('GET orders?period=90d returns 200', period90.status === 200);

  // Status filter
  const statusResp = await req('GET', '/api/seller/orders?status=pending', token, null);
  assert('GET orders?status=pending returns 200', statusResp.status === 200);
  assert('Status filter response has data', Array.isArray(statusResp.body?.data?.orders));

  // Search
  const searchResp = await req('GET', '/api/seller/orders?search=test', token, null);
  assert('GET orders?search returns 200', searchResp.status === 200);

  // ── GET individual order + status update ──
  const orders = d?.orders || [];
  let orderId = null;

  if (orders.length > 0) {
    orderId = orders[0].internal_id;
    console.log(`\n  [GET /api/seller/orders/${orderId}]`);
    const getOneResp = await req('GET', `/api/seller/orders/${orderId}`, token, null);
    assert(`GET single order ${orderId} returns 200`, getOneResp.status === 200, `got ${getOneResp.status}`);
    const od = getOneResp.body?.data;
    assert('order_id (ref) present', !!od?.order_id);
    assert('fulfillment_status present', typeof od?.fulfillment_status === 'string');
    assert('tracking_events is array', Array.isArray(od?.tracking_events));
    assert('buyer_name present', 'buyer_name' in (od || {}));

    // ── PUT /api/seller/orders/:id/status ──
    console.log(`\n  [PUT /api/seller/orders/${orderId}/status]`);
    const updateResp = await req('PUT', `/api/seller/orders/${orderId}/status`, token, { status: 'crafting' });
    assert('Update status returns 200', updateResp.status === 200, `got ${updateResp.status} — ${JSON.stringify(updateResp.body).substring(0,200)}`);
    assert('Updated status in response', updateResp.body?.data?.fulfillment_status === 'crafting', `got "${updateResp.body?.data?.fulfillment_status}"`);
    assert('tracking_events in status response', Array.isArray(updateResp.body?.data?.tracking_events));

    // Invalid status
    const badStatusResp = await req('PUT', `/api/seller/orders/${orderId}/status`, token, { status: 'INVALID' });
    assert('Invalid status returns 400', badStatusResp.status === 400, `got ${badStatusResp.status}`);

    // ── POST /api/seller/orders/:id/tracking ──
    console.log(`\n  [POST /api/seller/orders/${orderId}/tracking]`);
    const trackResp = await req('POST', `/api/seller/orders/${orderId}/tracking`, token, {
      tracking_number: 'TRACK-TEST-123',
      dispatch_note: 'Dispatched via test'
    });
    assert('Add tracking returns 200', trackResp.status === 200, `got ${trackResp.status}`);
    assert('Tracking number in response', trackResp.body?.data?.tracking_number === 'TRACK-TEST-123', `got "${trackResp.body?.data?.tracking_number}"`);

  } else {
    console.log('  ⚠ No orders in DB — skipping order detail/status tests');
  }

  // ── Auth guards ──
  console.log('\n  [Auth guards]');
  const unauthResp = await req('GET', '/api/seller/orders', null, null);
  assert('Unauthenticated GET returns 401', unauthResp.status === 401);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
