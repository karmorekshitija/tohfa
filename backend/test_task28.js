// test_task28.js — Task 28: Store Config
const http = require('http');
const db   = require('better-sqlite3')('tohfa.db');

function req(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname:'localhost', port:5000, path, method,
      headers: {
        'Content-Type':'application/json',
        ...(token ? { 'Authorization':'Bearer '+token } : {}),
        ...(data ? { 'Content-Length':Buffer.byteLength(data) } : {})
      }
    };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status:res.statusCode, body:JSON.parse(d) }); } catch(e) { resolve({ status:res.statusCode, body:d }); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let passed = 0, failed = 0;
function assert(label, cond, extra='') {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra?': '+extra:''}`); failed++; }
}

async function run() {
  console.log('\n=== Task 28: Store Config ===\n');

  const sellerUser = db.prepare(
    "SELECT u.email FROM users u JOIN seller_profiles s ON s.user_id = u.id WHERE u.role = 'seller' LIMIT 1"
  ).get();
  if (!sellerUser) { console.error('No seller'); process.exit(1); }
  console.log('  Using seller:', sellerUser.email);

  const loginResp = await req('POST', '/api/auth/login', null, { email:sellerUser.email, password:'password123' });
  assert('Login returns 200', loginResp.status === 200);
  const token = loginResp.body?.data?.access_token;
  assert('Token obtained', !!token);
  if (!token) process.exit(1);

  // ── GET /api/seller/store-config ──
  console.log('\n  [GET /api/seller/store-config]');
  const getResp = await req('GET', '/api/seller/store-config', token, null);
  assert('GET returns 200', getResp.status === 200, `got ${getResp.status}`);
  const d = getResp.body?.data;
  assert('Response has data', !!d);
  assert('onboarding_steps present', typeof d?.onboarding_steps === 'object');
  assert('steps_complete is integer', typeof d?.steps_complete === 'number');
  assert('shipping configuration present', typeof d?.shipping === 'object');
  assert('team_members is array', Array.isArray(d?.team_members));

  // ── PUT /api/seller/store-config ──
  console.log('\n  [PUT /api/seller/store-config]');
  const updatePayload = {
    accept_orders: false,
    return_policy: 'All botanical items are final sale. Art prints are eligible for refund within 7 days.',
    contact_email: 'support@artisan.studio',
    shipping: { flat_fee_enabled: false, store_pickup_enabled: true }
  };
  const putResp = await req('PUT', '/api/seller/store-config', token, updatePayload);
  assert('PUT returns 200', putResp.status === 200, `got ${putResp.status}`);
  const updatedData = putResp.body?.data;
  assert('accept_orders updated in onboarding_steps', updatedData?.onboarding_steps?.accept_orders?.complete === false);
  assert('return_policy returned', updatedData?.return_policy === updatePayload.return_policy);
  assert('contact_email returned', updatedData?.contact_email === updatePayload.contact_email);
  assert('shipping returned', updatedData?.shipping?.store_pickup_enabled === true);

  // Re-enable accept_orders to leave the store active
  const restoreResp = await req('PUT', '/api/seller/store-config', token, { accept_orders: true });
  assert('Restore accept_orders returns 200', restoreResp.status === 200);
  assert('accept_orders restored', restoreResp.body?.data?.onboarding_steps?.accept_orders?.complete === true);

  // ── Auth guard ──
  console.log('\n  [Auth guards]');
  const unauthResp = await req('GET', '/api/seller/store-config', null, null);
  assert('Unauthenticated GET returns 401', unauthResp.status === 401);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
