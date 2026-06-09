// test_task38.js — Task 38: Payment Health (GET status, POST run-check)
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
  console.log('\n=== Task 38: Payment Health ===\n');

  // Clean up and seed database
  db.prepare("PRAGMA foreign_keys = OFF").run();
  db.prepare("DELETE FROM admin_users WHERE username = 'admin_test'").run();
  db.prepare("DELETE FROM payment_health_logs WHERE check_type = 'test_check'").run();
  db.prepare("PRAGMA foreign_keys = ON").run();

  const hash = bcrypt.hashSync('password123', 10);
  db.prepare(`
    INSERT INTO admin_users (username, email, password_hash, display_name, role, is_active)
    VALUES ('admin_test', 'admin_test@test.com', ?, 'Test Admin', 'super_admin', 1)
  `).run(hash);

  // Insert a test payment health log
  db.prepare(`
    INSERT INTO payment_health_logs (check_type, status, api_response_ms, webhook_status, last_webhook_at, last_txn_id, last_txn_status, region, raw_payload, checked_at)
    VALUES ('test_check', 'healthy', 150, 'receiving', datetime('now'), 'test_txn_38', 'captured', 'India (South)', '{}', datetime('now'))
  `).run();

  // 1. Login to get token
  console.log('  [1. Login]');
  const loginResp = await req('POST', '/api/admin/auth/login', null, { username: 'admin_test', password: 'password123' });
  assert('Login status is 200', loginResp.status === 200);
  const token = loginResp.body?.data?.access_token;
  assert('Has access_token', !!token);

  // 2. GET /api/admin/payment-health
  console.log('\n  [2. GET /api/admin/payment-health]');
  const getResp = await req('GET', '/api/admin/payment-health', token);
  assert('GET payment-health returns 200', getResp.status === 200);
  assert('Response is success', getResp.body?.success === true);
  const healthData = getResp.body?.data;
  assert('Has overall_status', !!healthData?.overall_status);
  assert('Has api_response_ms', !!healthData?.api_response_ms);
  assert('Has webhook_status', !!healthData?.webhook_status);
  assert('Has webhook_event_log', Array.isArray(healthData?.webhook_event_log));

  // 3. POST /api/admin/payment-health/run-check
  console.log('\n  [3. POST /api/admin/payment-health/run-check]');
  const runResp = await req('POST', '/api/admin/payment-health/run-check', token);
  assert('POST run-check returns 200', runResp.status === 200);
  assert('Response is success', runResp.body?.success === true);
  const runData = runResp.body?.data;
  assert('Run check reports overall_status', !!runData?.overall_status);
  assert('Run check reports api_response_ms', !!runData?.api_response_ms);
  assert('Run check reports checked_at', !!runData?.checked_at);

  // Verify a new manual check row is inserted in database
  const manualLog = db.prepare("SELECT * FROM payment_health_logs WHERE check_type = 'manual' ORDER BY id DESC LIMIT 1").get();
  assert('Manual check logged in database', !!manualLog);
  assert('Database status matches response', manualLog?.status === runData?.overall_status);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
