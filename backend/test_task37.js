// test_task37.js — Task 37: Audit Logs (List, Filter, Diff)
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
  console.log('\n=== Task 37: Audit Logs ===\n');

  // Clean up and seed database
  db.prepare("PRAGMA foreign_keys = OFF").run();
  db.prepare("DELETE FROM admin_users WHERE username = 'admin_test'").run();
  db.prepare("DELETE FROM audit_logs WHERE actor_name = 'Test Actor Task 37'").run();
  db.prepare("PRAGMA foreign_keys = ON").run();

  const hash = bcrypt.hashSync('password123', 10);
  db.prepare(`
    INSERT INTO admin_users (username, email, password_hash, display_name, role, is_active)
    VALUES ('admin_test', 'admin_test@test.com', ?, 'Test Admin', 'super_admin', 1)
  `).run(hash);

  // Insert a test audit log entry
  const beforeJson = JSON.stringify({ is_sponsored: false });
  const afterJson = JSON.stringify({ is_sponsored: true });
  db.prepare(`
    INSERT INTO audit_logs (event_type, actor_id, actor_name, target_type, target_id, target_label, before_json, after_json, created_at)
    VALUES ('admin.product.sponsored_toggled', 1, 'Test Actor Task 37', 'product', 99, 'Test Product 37', ?, ?, '2026-06-06T12:00:00Z')
  `).run(beforeJson, afterJson);
  const testLogId = db.prepare("SELECT last_insert_rowid() as id").get().id;

  // 1. Login to get token
  console.log('  [1. Login]');
  const loginResp = await req('POST', '/api/admin/auth/login', null, { username: 'admin_test', password: 'password123' });
  assert('Login status is 200', loginResp.status === 200);
  const token = loginResp.body?.data?.access_token;
  assert('Has access_token', !!token);

  // 2. GET /api/admin/audit-logs (all logs)
  console.log('\n  [2. GET /api/admin/audit-logs]');
  const getResp = await req('GET', '/api/admin/audit-logs', token);
  assert('GET audit-logs returns 200', getResp.status === 200);
  assert('Response is success', getResp.body?.success === true);
  const logsList = getResp.body?.data?.logs || [];
  assert('Audit logs list has elements', logsList.length > 0);
  const testLog = logsList.find(l => l.id === testLogId);
  assert('Found test log entry in the list', !!testLog);
  assert('Test log actor_name matches', testLog?.actor_name === 'Test Actor Task 37');
  assert('Test log event_type matches', testLog?.event_type === 'admin.product.sponsored_toggled');
  assert('Test log has_diff is true', testLog?.has_diff === true);

  // 3. GET /api/admin/audit-logs (with filters)
  console.log('\n  [3. GET /api/admin/audit-logs with filters]');
  const filterResp = await req('GET', `/api/admin/audit-logs?event_type=admin.product.sponsored_toggled&actor=${encodeURIComponent('Test Actor Task 37')}&from_date=2026-06-06&to_date=2026-06-06`, token);
  assert('GET filtered audit-logs returns 200', filterResp.status === 200);
  const filteredList = filterResp.body?.data?.logs || [];
  assert('Filtered list has exactly 1 element', filteredList.length === 1);
  assert('First element in filtered list matches our ID', filteredList[0]?.id === testLogId);

  // 4. GET /api/admin/audit-logs/:log_id/diff (retrieve log diff)
  console.log('\n  [4. GET /api/admin/audit-logs/:log_id/diff]');
  const diffResp = await req('GET', `/api/admin/audit-logs/${testLogId}/diff`, token);
  assert('GET diff returns 200', diffResp.status === 200);
  assert('Diff before_json matches', diffResp.body?.data?.before_json === beforeJson);
  assert('Diff after_json matches', diffResp.body?.data?.after_json === afterJson);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
