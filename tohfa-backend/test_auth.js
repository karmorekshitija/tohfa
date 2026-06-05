const { server } = require('./src/server');
const db = require('./src/db');

async function runTests() {
  console.log('--- RUNNING AUTH API TESTS ---');
  const baseUrl = 'http://localhost:5000';
  
  // Clear tables before test
  db.prepare('DELETE FROM refresh_tokens').run();
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
