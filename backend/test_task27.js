// test_task27.js — Task 27: Seller Analytics
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
  console.log('\n=== Task 27: Seller Analytics ===\n');

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

  // ── GET /api/seller/analytics ──
  console.log('\n  [GET /api/seller/analytics]');
  
  // Default 30d
  const defaultResp = await req('GET', '/api/seller/analytics', token, null);
  assert('GET default analytics returns 200', defaultResp.status === 200, `got ${defaultResp.status}`);
  const d = defaultResp.body?.data;
  assert('Response has data', !!d);
  assert('period is 30d', d?.period === '30d');
  assert('kpis object present', typeof d?.kpis === 'object');
  assert('revenue_paise in kpis', 'revenue_paise' in (d?.kpis || {}));
  assert('avg_order_value_paise in kpis', 'avg_order_value_paise' in (d?.kpis || {}));
  assert('return_rate_pct in kpis', 'return_rate_pct' in (d?.kpis || {}));
  assert('repeat_buyer_pct in kpis', 'repeat_buyer_pct' in (d?.kpis || {}));
  assert('revenue_chart is array', Array.isArray(d?.revenue_chart));
  assert('traffic object present', typeof d?.traffic === 'object');
  assert('traffic sources is array', Array.isArray(d?.traffic?.sources));

  // Query parameter: period=7d
  const res7d = await req('GET', '/api/seller/analytics?period=7d', token, null);
  assert('GET analytics?period=7d returns 200', res7d.status === 200);
  assert('period is 7d', res7d.body?.data?.period === '7d');

  // Query parameter: period=90d
  const res90d = await req('GET', '/api/seller/analytics?period=90d', token, null);
  assert('GET analytics?period=90d returns 200', res90d.status === 200);
  assert('period is 90d', res90d.body?.data?.period === '90d');

  // Query parameter: period=1y
  const res1y = await req('GET', '/api/seller/analytics?period=1y', token, null);
  assert('GET analytics?period=1y returns 200', res1y.status === 200);
  assert('period is 1y', res1y.body?.data?.period === '1y');

  // ── GET /api/seller/analytics/export ──
  console.log('\n  [GET /api/seller/analytics/export]');
  const exportResp = await req('GET', '/api/seller/analytics/export', token, null);
  assert('GET analytics/export returns 200', exportResp.status === 200, `got ${exportResp.status}`);
  assert('CSV content-type or CSV body text', typeof exportResp.body === 'string' && exportResp.body.includes('Order Ref'));

  // ── Auth guard ──
  console.log('\n  [Auth guards]');
  const unauthResp = await req('GET', '/api/seller/analytics', null, null);
  assert('Unauthenticated GET returns 401', unauthResp.status === 401);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
