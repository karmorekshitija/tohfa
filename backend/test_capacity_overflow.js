const db = require('./src/db');
const jwt = require('jsonwebtoken');
const assert = require('assert');

process.env.JWT_SECRET = 'test_secret_for_capacity';
process.env.PORT = 5999;

const { app, server } = require('./src/server');

// Helper to make requests
async function makeRequest(path, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers,
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const res = await fetch(`http://localhost:5999${path}`, options);
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('--- STARTING CAPACITY MANAGEMENT & OVERFLOW TESTS ---');
  
  try {
    // 1. Setup mock database records
    db.exec("PRAGMA foreign_keys = OFF;");
    db.exec("DELETE FROM users;");
    db.exec("DELETE FROM seller_profiles;");
    db.exec("DELETE FROM listings;");
    db.exec("DELETE FROM products;");
    db.exec("DELETE FROM overflow_requests;");
    db.exec("DELETE FROM daily_order_tracking;");
    db.exec("DELETE FROM addresses;");
    db.exec("DELETE FROM orders;");
    db.exec("DELETE FROM order_items;");
    db.exec("PRAGMA foreign_keys = ON;");
    
    // Create seller
    db.prepare(`
      INSERT INTO users (id, full_name, email, password_hash, role, created_at)
      VALUES (1, 'Seller Test', 'seller@test.com', 'hash', 'seller', datetime('now'))
    `).run();
    
    db.prepare(`
      INSERT INTO seller_profiles (user_id, shop_name, is_approved, weekly_production_capacity, daily_order_limit)
      VALUES (1, 'Test Shop', 1, 5, 2)
    `).run();
    
    // Create buyer
    db.prepare(`
      INSERT INTO users (id, full_name, email, password_hash, role, created_at)
      VALUES (2, 'Buyer Test', 'buyer@test.com', 'hash', 'buyer', datetime('now'))
    `).run();
    
    // Create listing / product
    db.prepare(`
      INSERT INTO listings (id, seller_id, title, description, base_price, status, daily_product_cap)
      VALUES (10, 1, 'Amazing Mug', 'Great coffee mug', 10000, 'active', 2)
    `).run();
    
    db.prepare(`
      INSERT INTO products (id, seller_id, name, description, price_paise, stock_qty, status)
      VALUES (10, 1, 'Amazing Mug', 'Great coffee mug', 10000, 100, 'active')
    `).run();
    
    // Create address for buyer
    db.prepare(`
      INSERT INTO addresses (id, user_id, full_name, phone, line1, city, state, pincode, is_default)
      VALUES (100, 2, 'Buyer Test', '1234567890', '123 Street', 'Delhi', 'Delhi', '110001', 1)
    `).run();
    
    const sellerToken = jwt.sign({ user_id: 1, role: 'seller' }, process.env.JWT_SECRET);
    const buyerToken = jwt.sign({ user_id: 2, role: 'buyer' }, process.env.JWT_SECRET);
    
    console.log('[TEST 1] Get Capacity Settings');
    const getCap = await makeRequest('/api/seller/capacity-settings', 'GET', null, sellerToken);
    assert.strictEqual(getCap.status, 200);
    assert.strictEqual(getCap.data.data.weekly_production_capacity, 5);
    assert.strictEqual(getCap.data.data.daily_order_limit, 2);
    console.log('PASSED');
    
    console.log('[TEST 2] Update Capacity Settings');
    const updateCap = await makeRequest('/api/seller/capacity-settings', 'PUT', {
      weekly_production_capacity: 10,
      daily_order_limit: 3
    }, sellerToken);
    assert.strictEqual(updateCap.status, 200);
    assert.strictEqual(updateCap.data.data.weekly_production_capacity, 10);
    assert.strictEqual(updateCap.data.data.daily_order_limit, 3);
    console.log('PASSED');
    
    console.log('[TEST 3] Check Capacity - Within Limits');
    const checkCapOk = await makeRequest('/api/capacity/check', 'POST', {
      product_id: 10,
      quantity: 1
    }, buyerToken);
    assert.strictEqual(checkCapOk.status, 200);
    assert.strictEqual(checkCapOk.data.overflow, false);
    console.log('PASSED');
    
    console.log('[TEST 4] Check Capacity - Exceeds Limits');
    // Try checking out quantity 4, which exceeds weekly cap (10)? No, exceeds listing cap of 2 and daily limit of 3
    const checkCapFail = await makeRequest('/api/capacity/check', 'POST', {
      product_id: 10,
      quantity: 4
    }, buyerToken);
    assert.strictEqual(checkCapFail.status, 200);
    assert.strictEqual(checkCapFail.data.overflow, true);
    assert.ok(checkCapFail.data.overflow_request_id);
    const reqId = checkCapFail.data.overflow_request_id;
    console.log('PASSED. Created overflow request ID:', reqId);
    
    console.log('[TEST 5] Seller gets overflow requests list');
    const sellerList = await makeRequest('/api/seller/overflow-requests', 'GET', null, sellerToken);
    assert.strictEqual(sellerList.status, 200);
    assert.strictEqual(sellerList.data.data.length, 1);
    assert.strictEqual(sellerList.data.data[0].id, parseInt(reqId));
    console.log('PASSED');
    
    console.log('[TEST 6] Seller accepts overflow request');
    const acceptRes = await makeRequest(`/api/seller/overflow-requests/${reqId}/accept`, 'POST', {
      seller_proposed_date: '2026-06-15',
      seller_notes: 'Will prepare standard batch by then'
    }, sellerToken);
    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptRes.data.data.status, 'accepted');
    console.log('PASSED');
    
    console.log('[TEST 7] Buyer gets overflow requests list');
    const buyerList = await makeRequest('/api/buyer/overflow-requests', 'GET', null, buyerToken);
    assert.strictEqual(buyerList.status, 200);
    assert.strictEqual(buyerList.data.data.length, 1);
    assert.strictEqual(buyerList.data.data[0].status, 'accepted');
    console.log('PASSED');
    
    console.log('[TEST 8] Buyer confirms terms');
    const confirmRes = await makeRequest(`/api/buyer/overflow-requests/${reqId}/confirm`, 'POST', null, buyerToken);
    assert.strictEqual(confirmRes.status, 200);
    assert.strictEqual(confirmRes.data.data.status, 'confirmed');
    console.log('PASSED');
    
    console.log('[TEST 9] Auto-expiry background job testing');
    // Create an old pending overflow request
    db.prepare(`
      INSERT INTO overflow_requests (id, buyer_id, seller_id, listing_id, quantity, original_price_paise, status, created_at, updated_at)
      VALUES (999, 2, 1, 10, 1, 10000, 'pending', datetime('now', '-3 days'), datetime('now', '-3 days'))
    `).run();
    
    // Trigger expiry job manually via the test endpoint
    const expiryTrigger = await makeRequest('/api/test/trigger-expiry-check', 'POST', null, null);
    assert.strictEqual(expiryTrigger.status, 200);
    
    // Verify overflow_requests table updated status to 'expired'
    const expiredReq = db.prepare('SELECT status FROM overflow_requests WHERE id = 999').get();
    assert.strictEqual(expiredReq.status, 'expired');
    console.log('PASSED');
    
    console.log('\nALL TESTS COMPLETED SUCCESSFULLY!');
    
  } catch (err) {
    console.error('TEST FAIL:', err);
    process.exit(1);
  } finally {
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  }
}

// Wait for database connections / server to start
setTimeout(runTests, 1000);
