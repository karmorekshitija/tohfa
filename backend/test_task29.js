// test_task29.js — Task 29: Seller Payouts
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
  console.log('\n=== Task 29: Seller Payouts ===\n');

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

  // ── GET /api/seller/payouts ──
  console.log('\n  [GET /api/seller/payouts]');
  const listResp = await req('GET', '/api/seller/payouts', token, null);
  assert('GET payouts returns 200', listResp.status === 200, `got ${listResp.status}`);
  
  const d = listResp.body?.data;
  assert('Response has data', !!d);
  assert('current_balance_paise in response', 'current_balance_paise' in (d || {}));
  assert('next_payout_date in response', 'next_payout_date' in (d || {}));
  assert('payouts is array', Array.isArray(d?.payouts));

  if (d?.payouts?.length > 0) {
    const p = d.payouts[0];
    assert('payout has payout_id', 'payout_id' in p);
    assert('payout has date', 'date' in p);
    assert('payout has txn_ref', 'txn_ref' in p);
    assert('payout has amount_paise', 'amount_paise' in p);
    assert('payout has status', 'status' in p);
  } else {
    console.log('  No payouts in history (empty array), verified structure');
  }

  // ── Auth guard ──
  console.log('\n  [Auth guards]');
  const unauthResp = await req('GET', '/api/seller/payouts', null, null);
  assert('Unauthenticated GET returns 401', unauthResp.status === 401);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
