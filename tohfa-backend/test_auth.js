const { server } = require('./src/server');
const db = require('./src/db');

async function runTests() {
  console.log('--- RUNNING AUTH API TESTS ---');
  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}`;
  
  // Clear tables before test
  db.prepare('DELETE FROM refresh_tokens').run();
  db.prepare('DELETE FROM seller_profiles').run();
  db.prepare('DELETE FROM password_reset_tokens').run();
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
    
    // Test 12: Successful logout
    // We first login to get a fresh pair of tokens
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john@example.com',
        password: 'password123'
      })
    });
    const loginData = await loginRes.json();
    const accessToken = loginData.data.access_token;
    const refreshToken = loginData.data.refresh_token;
    
    // Check token is in DB
    const hashedRt = require('crypto').createHash('sha256').update(refreshToken).digest('hex');
    const dbTokenBefore = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hashedRt);
    if (!dbTokenBefore) {
      throw new Error('Refresh token not found in database after login');
    }
    
    const res12 = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    });
    
    console.log('Test 12 Status:', res12.status);
    const body12 = await res12.json();
    if (res12.status !== 200 || !body12.success || body12.data.message !== 'Logged out successfully') {
      throw new Error(`Expected 200 with successful logout message, got ${res12.status} ${JSON.stringify(body12)}`);
    }
    
    // Verify token is deleted from DB
    const dbTokenAfter = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hashedRt);
    if (dbTokenAfter) {
      throw new Error('Refresh token still exists in database after logout');
    }
    console.log('✓ Test 12 Passed: Successful logout and token cleanup');

    // Test 13: Logout with invalid auth header
    const res13 = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer invalid_access_token`
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    });
    
    console.log('Test 13 Status:', res13.status);
    const body13 = await res13.json();
    if (res13.status !== 401 || body13.code !== 'UNAUTHORIZED') {
      throw new Error(`Expected 401 with UNAUTHORIZED, got ${res13.status} ${JSON.stringify(body13)}`);
    }
    console.log('✓ Test 13 Passed: Logout with invalid authorization rejected');

    // Test 14: Logout with missing refresh_token in body
    const res14 = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({})
    });
    
    console.log('Test 14 Status:', res14.status);
    const body14 = await res14.json();
    if (res14.status !== 400 || body14.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected 400 with VALIDATION_ERROR, got ${res14.status} ${JSON.stringify(body14)}`);
    }
    console.log('✓ Test 14 Passed: Logout with missing refresh token rejected');
    
    // Test 15: Successful refresh token rotation
    // Let's log in to get a fresh refresh token
    const loginRes2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john@example.com',
        password: 'password123'
      })
    });
    const loginData2 = await loginRes2.json();
    const originalRt = loginData2.data.refresh_token;
    
    const res15 = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: originalRt
      })
    });
    
    console.log('Test 15 Status:', res15.status);
    const body15 = await res15.json();
    if (res15.status !== 200 || !body15.success || !body15.data.access_token || !body15.data.refresh_token) {
      throw new Error(`Expected 200 with new tokens, got ${res15.status} ${JSON.stringify(body15)}`);
    }
    console.log('✓ Test 15 Passed: Token refresh rotation succeeded');

    // Test 16: Try to use the rotated (used) refresh token again
    const res16 = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: originalRt
      })
    });
    
    console.log('Test 16 Status:', res16.status);
    const body16 = await res16.json();
    if (res16.status !== 401 || body16.code !== 'INVALID_REFRESH_TOKEN') {
      throw new Error(`Expected 401 with INVALID_REFRESH_TOKEN for reuse, got ${res16.status} ${JSON.stringify(body16)}`);
    }
    console.log('✓ Test 16 Passed: Reusing a rotated refresh token is correctly rejected');

    // Test 17: Expired refresh token
    // Create an expired token in the database manually
    const expiredRt = 'expired_token_abc_123';
    const hashedExpiredRt = require('crypto').createHash('sha256').update(expiredRt).digest('hex');
    const pastExpiresAt = new Date(Date.now() - 60000).toISOString(); // 1 minute in the past
    db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(loginData2.data.user.id, hashedExpiredRt, pastExpiresAt);
    
    const res17 = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: expiredRt
      })
    });
    
    console.log('Test 17 Status:', res17.status);
    const body17 = await res17.json();
    if (res17.status !== 401 || body17.code !== 'INVALID_REFRESH_TOKEN') {
      throw new Error(`Expected 401 with INVALID_REFRESH_TOKEN for expired token, got ${res17.status}`);
    }
    console.log('✓ Test 17 Passed: Expired refresh token is rejected');
    
    // Test 18: Successful forgot password request (registered email)
    const res18 = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john@example.com'
      })
    });
    
    console.log('Test 18 Status:', res18.status);
    const body18 = await res18.json();
    if (res18.status !== 200 || !body18.success || body18.data.message !== 'If that email is registered, a reset link has been sent.') {
      throw new Error(`Expected 200 with generic success message, got ${res18.status}`);
    }
    
    // Check that a token was indeed inserted in the database
    const dbToken = db.prepare('SELECT * FROM password_reset_tokens WHERE user_id = ?').get(loginData2.data.user.id);
    if (!dbToken) {
      throw new Error('Expected reset token to be created in database');
    }
    console.log('✓ Test 18 Passed: Forgot password generated token for registered email');

    // Test 19: Forgot password request for non-registered email
    const res19 = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com'
      })
    });
    
    console.log('Test 19 Status:', res19.status);
    const body19 = await res19.json();
    if (res19.status !== 200 || !body19.success || body19.data.message !== 'If that email is registered, a reset link has been sent.') {
      throw new Error(`Expected 200 with generic success message for non-registered email, got ${res19.status}`);
    }
    console.log('✓ Test 19 Passed: Non-registered email handled silently and returned 200');

    // Test 20: Validation error (invalid email format)
    const res20 = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email-format'
      })
    });
    
    console.log('Test 20 Status:', res20.status);
    const body20 = await res20.json();
    if (res20.status !== 400 || body20.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected 400 with VALIDATION_ERROR, got ${res20.status} ${JSON.stringify(body20)}`);
    }
    console.log('✓ Test 20 Passed: Invalid email rejected with 400');
    
    // We need the plain reset token generated in Test 18
    // Since we logged it, let's find it from the database record or we can generate a new one specifically for Test 21
    const resetUserEmail = 'jane@example.com'; // Let's use Jane's account
    const resetUser = db.prepare('SELECT id FROM users WHERE email = ?').get(resetUserEmail);
    
    const plainResetToken = 'my_secret_reset_token_123_xyz';
    const hashedResetToken = require('crypto').createHash('sha256').update(plainResetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour
    
    db.prepare('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(resetUser.id, hashedResetToken, expiresAt);
    
    // Insert some refresh tokens to test force-logout (token cleanup)
    db.prepare("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, 'dummy_hash_1', ?)").run(resetUser.id, expiresAt);
    db.prepare("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, 'dummy_hash_2', ?)").run(resetUser.id, expiresAt);
    
    // Test 21: Successful reset password
    const res21 = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: plainResetToken,
        new_password: 'newpassword789'
      })
    });
    
    console.log('Test 21 Status:', res21.status);
    const body21 = await res21.json();
    if (res21.status !== 200 || !body21.success || body21.data.message !== 'Password updated successfully. Please log in.') {
      throw new Error(`Expected 200 with success message, got ${res21.status} ${JSON.stringify(body21)}`);
    }
    
    // Verify token marked as used
    const dbTokenUsed = db.prepare('SELECT used FROM password_reset_tokens WHERE token_hash = ?').get(hashedResetToken);
    if (dbTokenUsed.used !== 1) {
      throw new Error('Reset token was not marked as used in DB');
    }
    
    // Verify all refresh tokens for user deleted
    const dbRefreshTokens = db.prepare('SELECT COUNT(*) as count FROM refresh_tokens WHERE user_id = ?').get(resetUser.id);
    if (dbRefreshTokens.count !== 0) {
      throw new Error(`Expected 0 refresh tokens, found ${dbRefreshTokens.count}`);
    }
    console.log('✓ Test 21 Passed: Password reset succeeded and forced logouts');

    // Test 22: Reusing the already used reset token
    const res22 = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: plainResetToken,
        new_password: 'anotherpassword111'
      })
    });
    
    console.log('Test 22 Status:', res22.status);
    const body22 = await res22.json();
    if (res22.status !== 400 || body22.code !== 'INVALID_RESET_TOKEN') {
      throw new Error(`Expected 400 with INVALID_RESET_TOKEN for reused token, got ${res22.status}`);
    }
    console.log('✓ Test 22 Passed: Reusing password reset token is blocked');

    // Test 23: Verify login with new password and rejection of old password
    const res23_old = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: resetUserEmail,
        password: 'password123' // Old password
      })
    });
    console.log('Test 23 Old Pass Status:', res23_old.status);
    if (res23_old.status !== 401) {
      throw new Error('Old password should be rejected after reset');
    }
    
    const res23_new = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: resetUserEmail,
        password: 'newpassword789' // New password
      })
    });
    console.log('Test 23 New Pass Status:', res23_new.status);
    if (res23_new.status !== 200) {
      throw new Error('New password should login successfully');
    }
    console.log('✓ Test 23 Passed: Login works with new password and rejects old password');

    // Test 24: Expired reset token
    const expiredToken = 'expired_reset_token_xyz';
    const hashedExpiredToken = require('crypto').createHash('sha256').update(expiredToken).digest('hex');
    const pastExpiresAtReset = new Date(Date.now() - 60000).toISOString();
    db.prepare('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(resetUser.id, hashedExpiredToken, pastExpiresAtReset);
    
    const res24 = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: expiredToken,
        new_password: 'password_new_123'
      })
    });
    
    console.log('Test 24 Status:', res24.status);
    const body24 = await res24.json();
    if (res24.status !== 400 || body24.code !== 'INVALID_RESET_TOKEN') {
      throw new Error(`Expected 400 INVALID_RESET_TOKEN for expired reset token, got ${res24.status}`);
    }
    console.log('✓ Test 24 Passed: Expired reset token rejected');

    // Test 25: Weak password on reset
    const res25 = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: plainResetToken,
        new_password: '123'
      })
    });
    
    console.log('Test 25 Status:', res25.status);
    const body25 = await res25.json();
    if (res25.status !== 400 || body25.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected 400 VALIDATION_ERROR for short password, got ${res25.status}`);
    }
    console.log('✓ Test 25 Passed: Weak password on reset rejected');
    
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
