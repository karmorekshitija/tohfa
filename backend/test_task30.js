// test_task30.js — Task 30: ZAI Mode
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
  console.log('\n=== Task 30: ZAI Mode Toggle ===\n');

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

  // Get initial profile
  const profileResp = await req('GET', '/api/seller/profile', token, null);
  assert('GET profile returns 200', profileResp.status === 200);
  const initialZai = !!profileResp.body?.data?.zai_mode_enabled;
  console.log(`  Initial ZAI Mode: ${initialZai}`);

  // Toggle true
  console.log('\n  [PUT /api/seller/zai-mode (true)]');
  const toggleTrueResp = await req('PUT', '/api/seller/zai-mode', token, { enabled: true });
  assert('PUT true returns 200', toggleTrueResp.status === 200, `got ${toggleTrueResp.status}`);
  assert('Response shows enabled true', toggleTrueResp.body?.data?.enabled === true);

  // Check DB state
  const dbEnabled1 = db.prepare('SELECT enabled FROM zai_mode_state WHERE seller_id = (SELECT id FROM seller_profiles WHERE user_id = (SELECT id FROM users WHERE email = ?))').get(sellerUser.email).enabled;
  assert('DB shows enabled = 1', dbEnabled1 === 1);

  // Toggle false
  console.log('\n  [PUT /api/seller/zai-mode (false)]');
  const toggleFalseResp = await req('PUT', '/api/seller/zai-mode', token, { enabled: false });
  assert('PUT false returns 200', toggleFalseResp.status === 200, `got ${toggleFalseResp.status}`);
  assert('Response shows enabled false', toggleFalseResp.body?.data?.enabled === false);

  // Check DB state
  const dbEnabled2 = db.prepare('SELECT enabled FROM zai_mode_state WHERE seller_id = (SELECT id FROM seller_profiles WHERE user_id = (SELECT id FROM users WHERE email = ?))').get(sellerUser.email).enabled;
  assert('DB shows enabled = 0', dbEnabled2 === 0);

  // Restore initial state
  await req('PUT', '/api/seller/zai-mode', token, { enabled: initialZai });
  console.log(`  Restored initial state: ${initialZai}`);

  // ── Auth guard ──
  console.log('\n  [Auth guards]');
  const unauthResp = await req('PUT', '/api/seller/zai-mode', null, { enabled: true });
  assert('Unauthenticated PUT returns 401', unauthResp.status === 401);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
