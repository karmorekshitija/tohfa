// test_task31.js — Task 31: Become a Seller
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
  console.log('\n=== Task 31: Become a Seller ===\n');

  // Clean up any existing test user first
  db.prepare("DELETE FROM users WHERE email = 'test_buyer_become@test.com'").run();
  db.prepare("DELETE FROM seller_profiles WHERE handle = 'become_botanical'").run();

  // 1. Create a buyer user
  console.log('  Registering test buyer...');
  const signupResp = await req('POST', '/api/auth/register/buyer', null, {
    email: 'test_buyer_become@test.com',
    password: 'password123',
    full_name: 'Test Become Buyer'
  });
  assert('Signup returns 201', signupResp.status === 201, `got ${signupResp.status}`);

  // 2. Login to get token
  const loginResp = await req('POST', '/api/auth/login', null, {
    email: 'test_buyer_become@test.com',
    password: 'password123'
  });
  assert('Login returns 200', loginResp.status === 200);
  const token = loginResp.body?.data?.access_token;
  assert('Token obtained', !!token);
  if (!token) process.exit(1);

  // 3. Call POST /api/seller/become
  console.log('\n  [POST /api/seller/become]');
  const becomePayload = {
    display_name: 'Botanical Atelier of Become',
    handle: 'become_botanical'
  };
  const becomeResp = await req('POST', '/api/seller/become', token, becomePayload);
  assert('POST become returns 201', becomeResp.status === 201, `got ${becomeResp.status} - ${JSON.stringify(becomeResp.body)}`);
  assert('Response has success true', becomeResp.body?.success === true);
  assert('Response contains seller_id', !!becomeResp.body?.data?.seller_id);
  assert('Response handle matches', becomeResp.body?.data?.handle === becomePayload.handle);

  // 4. Verify user role is now seller
  console.log('\n  [GET /api/profile/me]');
  const profileResp = await req('GET', '/api/profile/me', token, null);
  assert('GET profile returns 200', profileResp.status === 200);
  assert('User role is now seller', profileResp.body?.data?.role === 'seller', `got role: ${profileResp.body?.data?.role}`);

  // 5. Verify seller dashboard access
  console.log('\n  [GET /api/seller/dashboard]');
  const dashResp = await req('GET', '/api/seller/dashboard', token, null);
  assert('GET seller dashboard returns 200', dashResp.status === 200, `got ${dashResp.status}`);

  // ── Auth guard ──
  console.log('\n  [Auth guards]');
  const unauthResp = await req('POST', '/api/seller/become', null, becomePayload);
  assert('Unauthenticated POST returns 401', unauthResp.status === 401);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
