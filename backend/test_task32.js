// test_task32.js — Task 32: Admin Login
const http = require('http');
const db   = require('better-sqlite3')('tohfa.db');
const bcrypt = require('bcrypt');

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
  console.log('\n=== Task 32: Admin Login ===\n');

  // Clean up and seed admin users
  db.prepare("DELETE FROM admin_users WHERE username IN ('admin_test', 'admin_inactive')").run();

  const hash = bcrypt.hashSync('password123', 10);
  db.prepare(`
    INSERT INTO admin_users (username, email, password_hash, display_name, role, is_active)
    VALUES ('admin_test', 'admin_test@test.com', ?, 'Test Admin', 'superadmin', 1)
  `).run(hash);

  db.prepare(`
    INSERT INTO admin_users (username, email, password_hash, display_name, role, is_active)
    VALUES ('admin_inactive', 'admin_inactive@test.com', ?, 'Inactive Admin', 'moderator', 0)
  `).run(hash);

  // 1. Correct login
  console.log('  [Correct Credentials]');
  const loginResp = await req('POST', '/api/admin/auth/login', null, { username: 'admin_test', password: 'password123' });
  assert('Login returns 200', loginResp.status === 200, `got ${loginResp.status}`);
  assert('Response has access_token', !!loginResp.body?.data?.access_token);
  assert('Response role matches', loginResp.body?.data?.admin?.role === 'superadmin');

  // 2. Incorrect password
  console.log('\n  [Incorrect Password]');
  const wrongPassResp = await req('POST', '/api/admin/auth/login', null, { username: 'admin_test', password: 'wrongpassword' });
  assert('Incorrect password returns 401', wrongPassResp.status === 401, `got ${wrongPassResp.status}`);

  // 3. Non-existent username
  console.log('\n  [Invalid Username]');
  const wrongUserResp = await req('POST', '/api/admin/auth/login', null, { username: 'non_existent_admin', password: 'password123' });
  assert('Invalid username returns 401', wrongUserResp.status === 401);

  // 4. Inactive account
  console.log('\n  [Inactive Account]');
  const inactiveResp = await req('POST', '/api/admin/auth/login', null, { username: 'admin_inactive', password: 'password123' });
  assert('Inactive account returns 403', inactiveResp.status === 403, `got ${inactiveResp.status}`);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
