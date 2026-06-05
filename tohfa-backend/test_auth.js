const { server } = require('./src/server');
const db = require('./src/db');

async function runTests() {
  console.log('--- RUNNING AUTH API TESTS ---');
  const baseUrl = 'http://localhost:5000';
  
  // Clear tables before test
  db.prepare('DELETE FROM refresh_tokens').run();
  db.prepare('DELETE FROM seller_profiles').run();
  db.prepare('DELETE FROM users').run();
  
  let exitCode = 0;
  
  try {
    // Test 1: Successful buyer registration
    const res1 = await fetch(`${baseUrl}/api/auth/register/buyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      })
    });
    
    console.log('Test 1 Status:', res1.status);
    const body1 = await res1.json();
    console.log('Test 1 Body:', JSON.stringify(body1, null, 2));
    
    if (res1.status !== 201) {
      throw new Error(`Expected 201, got ${res1.status}`);
    }
    if (!body1.success || !body1.data.user || !body1.data.access_token || !body1.data.refresh_token) {
      throw new Error('Response shape mismatch on successful registration');
    }
    if (body1.data.user.role !== 'buyer' || body1.data.user.email !== 'john@example.com') {
      throw new Error('User fields mismatch');
    }
    console.log('✓ Test 1 Passed: Successful buyer registration');

    // Test 2: Validation error (missing fields/weak password)
    const res2 = await fetch(`${baseUrl}/api/auth/register/buyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'J',
        email: 'invalid-email',
        password: '123'
      })
    });
    
    console.log('Test 2 Status:', res2.status);
    const body2 = await res2.json();
    if (res2.status !== 400 || body2.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected 400 with VALIDATION_ERROR, got ${res2.status} ${body2.code}`);
    }
    console.log('✓ Test 2 Passed: Validation error handled correctly');

    // Test 3: Duplicate email error
    const res3 = await fetch(`${baseUrl}/api/auth/register/buyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'John Another',
        email: 'john@example.com',
        password: 'password456'
      })
    });
    
    console.log('Test 3 Status:', res3.status);
    const body3 = await res3.json();
    if (res3.status !== 409 || body3.code !== 'EMAIL_EXISTS') {
      throw new Error(`Expected 409 with EMAIL_EXISTS, got ${res3.status} ${body3.code}`);
    }
    console.log('✓ Test 3 Passed: Duplicate email handled correctly');
    
    // Test 4: Successful seller registration
    const res4 = await fetch(`${baseUrl}/api/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        shop_name: 'Jane Crafts',
        shop_bio: 'Beautiful handmade items',
        ships_in_days: 5,
        instagram_handle: '@jane_crafts'
      })
    });
    
    console.log('Test 4 Status:', res4.status);
    const body4 = await res4.json();
    console.log('Test 4 Body:', JSON.stringify(body4, null, 2));
    
    if (res4.status !== 201) {
      throw new Error(`Expected 201, got ${res4.status}`);
    }
    if (!body4.success || !body4.data.user || !body4.data.seller_profile || !body4.data.access_token || !body4.data.refresh_token) {
      throw new Error('Response shape mismatch on successful seller registration');
    }
    if (body4.data.user.role !== 'seller' || body4.data.user.email !== 'jane@example.com') {
      throw new Error('User fields mismatch on seller registration');
    }
    if (body4.data.seller_profile.shop_name !== 'Jane Crafts' || body4.data.seller_profile.is_approved !== false) {
      throw new Error('Seller profile mismatch');
    }
    
    // Verify that the instagram handle is stored without the @ symbol
    const savedProfile = db.prepare('SELECT instagram_handle FROM seller_profiles WHERE user_id = ?').get(body4.data.user.id);
    if (savedProfile.instagram_handle !== 'jane_crafts') {
      throw new Error(`Expected instagram_handle to be 'jane_crafts', got '${savedProfile.instagram_handle}'`);
    }
    console.log('✓ Test 4 Passed: Successful seller registration and @ strip');

    // Test 5: Validation error for seller registration
    const res5 = await fetch(`${baseUrl}/api/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Jane Smith',
        email: 'jane2@example.com',
        password: 'password123',
        shop_name: '', // Invalid
        ships_in_days: 5
      })
    });
    
    console.log('Test 5 Status:', res5.status);
    const body5 = await res5.json();
    if (res5.status !== 400 || body5.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected 400 with VALIDATION_ERROR, got ${res5.status} ${body5.code}`);
    }
    console.log('✓ Test 5 Passed: Seller validation error handled correctly');
    
    // Test 6: Successful login (buyer)
    const res6 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john@example.com',
        password: 'password123'
      })
    });
    
    console.log('Test 6 Status:', res6.status);
    const body6 = await res6.json();
    if (res6.status !== 200 || !body6.success || body6.data.user.role !== 'buyer' || !body6.data.access_token || !body6.data.refresh_token) {
      throw new Error(`Expected 200 with successful buyer login, got ${res6.status}`);
    }
    console.log('✓ Test 6 Passed: Successful buyer login');

    // Test 7: Successful login (seller)
    const res7 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'jane@example.com',
        password: 'password123'
      })
    });
    
    console.log('Test 7 Status:', res7.status);
    const body7 = await res7.json();
    if (res7.status !== 200 || !body7.success || body7.data.user.role !== 'seller') {
      throw new Error(`Expected 200 with successful seller login, got ${res7.status}`);
    }
    console.log('✓ Test 7 Passed: Successful seller login');

    // Test 8: Failed login (wrong password)
    const res8 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john@example.com',
        password: 'wrongpassword'
      })
    });
    
    console.log('Test 8 Status:', res8.status);
    const body8 = await res8.json();
    if (res8.status !== 401 || body8.code !== 'INVALID_CREDENTIALS' || body8.message !== "Hm, that credential set doesn't seem right.") {
      throw new Error(`Expected 401 with correct message, got ${res8.status} ${JSON.stringify(body8)}`);
    }
    console.log('✓ Test 8 Passed: Incorrect credentials handled correctly');

    // Test 9: Failed login (nonexistent user)
    const res9 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'somepassword'
      })
    });
    
    console.log('Test 9 Status:', res9.status);
    const body9 = await res9.json();
    if (res9.status !== 401 || body9.code !== 'INVALID_CREDENTIALS') {
      throw new Error(`Expected 401, got ${res9.status}`);
    }
    console.log('✓ Test 9 Passed: Nonexistent user login handled correctly');

    // Test 10: Inactive user login
    db.prepare("INSERT INTO users (email, password_hash, full_name, role, is_active) VALUES ('inactive@example.com', 'dummy', 'Inactive User', 'buyer', 0)").run();
    const res10 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'inactive@example.com',
        password: 'dummy' // wait, bcrypt compare will fail if we just put 'dummy', let's use the hashed password!
      })
    });
    // Wait, let's hash a password for inactive/banned users in our test database first or use bcrypt in the script.
    // Actually, we can just hash 'password123' and insert it.
    const testHash = await require('bcrypt').hash('password123', 12);
    db.prepare("UPDATE users SET password_hash = ? WHERE email = 'inactive@example.com'").run(testHash);
    
    const res10_retry = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'inactive@example.com',
        password: 'password123'
      })
    });
    
    console.log('Test 10 Status:', res10_retry.status);
    const body10 = await res10_retry.json();
    if (res10_retry.status !== 403 || body10.code !== 'ACCOUNT_INACTIVE') {
      throw new Error(`Expected 403 with ACCOUNT_INACTIVE, got ${res10_retry.status} ${JSON.stringify(body10)}`);
    }
    console.log('✓ Test 10 Passed: Inactive user login blocked');

    // Test 11: Banned user login
    db.prepare("INSERT INTO users (email, password_hash, full_name, role, is_banned) VALUES ('banned@example.com', ?, 'Banned User', 'buyer', 1)").run(testHash);
    const res11 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'banned@example.com',
        password: 'password123'
      })
    });
    
    console.log('Test 11 Status:', res11.status);
    const body11 = await res11.json();
    if (res11.status !== 403 || body11.code !== 'ACCOUNT_BANNED') {
      throw new Error(`Expected 403 with ACCOUNT_BANNED, got ${res11.status} ${JSON.stringify(body11)}`);
    }
    console.log('✓ Test 11 Passed: Banned user login blocked');
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    exitCode = 1;
  } finally {
    server.close(() => {
      console.log('Test server closed');
      process.exit(exitCode);
    });
  }
}

// Give a tiny moment for server to bind
setTimeout(runTests, 200);
