process.env.PORT = '5005';
const { app, server } = require('./src/server.js');
const db = require('./src/db.js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const PORT = process.env.PORT || 5005;
const baseUrl = 'http://localhost:' + PORT;
const JWT_SECRET = process.env.JWT_SECRET || 'tohfa_super_secret_key_987654321';

async function runTests() {
  let exitCode = 0;
  try {
    console.log('--- Cleaning up database ---');
    db.prepare("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_po_%')").run();
    db.prepare("DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE product_type_tag = 'test_po_resin')").run();
    db.prepare("DELETE FROM custom_offers WHERE conversation_id IN (SELECT id FROM conversations WHERE product_type_tag = 'test_po_resin')").run();
    db.prepare("DELETE FROM orders WHERE conversation_id IN (SELECT id FROM conversations WHERE product_type_tag = 'test_po_resin')").run();
    db.prepare("DELETE FROM conversations WHERE product_type_tag = 'test_po_resin'").run();
    db.prepare("DELETE FROM listings WHERE title LIKE 'Test PO%'").run();
    db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_po_%')").run();
    db.prepare("DELETE FROM users WHERE email LIKE 'test_po_%'").run();

    console.log('--- Seeding test database ---');
    // 1. Seller User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_po_seller@test.com', 'hash', 'Test PO Seller', 'seller')
    `).run();
    const sellerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Seller Profile
    db.prepare(`
      INSERT INTO seller_profiles (user_id, shop_name, is_approved)
      VALUES (?, 'Test PO Shop', 1)
    `).run(sellerId);

    // 2. Buyer User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_po_buyer@test.com', 'hash', 'Test PO Buyer', 'buyer')
    `).run();
    const buyerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // 3. Unauthorized User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_po_unauth@test.com', 'hash', 'Test PO Unauth', 'buyer')
    `).run();
    const unauthId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // 4. Custom listing
    db.prepare(`
      INSERT INTO listings (seller_id, title, category, base_price, ships_in_days, listing_type, status)
      VALUES (?, 'Test PO Resin Listing 1', 'resin_art', 35000, 5, 'custom', 'active')
    `).run(sellerId);
    const listingId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // 5. Generate JWT tokens
    const buyerToken = jwt.sign({ user_id: buyerId, email: 'test_po_buyer@test.com', role: 'buyer' }, JWT_SECRET);
    const sellerToken = jwt.sign({ user_id: sellerId, email: 'test_po_seller@test.com', role: 'seller' }, JWT_SECRET);
    const unauthToken = jwt.sign({ user_id: unauthId, email: 'test_po_unauth@test.com', role: 'buyer' }, JWT_SECRET);

    // 6. Conversation
    db.prepare(`
      INSERT INTO conversations (seller_id, buyer_id, listing_id, status, intake_complete, intake_summary, product_type_tag, created_at, updated_at)
      VALUES (?, ?, ?, 'live', 1, '{"customText":"Initials RK"}', 'test_po_resin', datetime('now'), datetime('now'))
    `).run(sellerId, buyerId, listingId);
    const convId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // 7. Custom Offer
    db.prepare(`
      INSERT INTO custom_offers (conversation_id, seller_id, buyer_id, price, delivery_date, status, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, 350, '2026-07-30', 'pending', '2026-08-30T00:00:00.000Z', datetime('now'), datetime('now'))
    `).run(convId, sellerId, buyerId);
    const offerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    console.log(`Seeded: Seller ${sellerId}, Buyer ${buyerId}, Listing ${listingId}, Conversation ${convId}, Offer ${offerId}`);

    // ==========================================
    // TEST 1: POST /api/payments/verify
    // ==========================================
    console.log('\n--- Test 1: Payment Verification & Validations ---');

    const razorpay_order_id = 'order_abc123';
    const razorpay_payment_id = 'pay_xyz789';
    const secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_mocksecret12345';
    const valid_signature = crypto.createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    // 1.1 Invalid Signature
    const resInvalidSig = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        conversation_id: convId,
        offer_id: offerId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature: 'wrong_signature'
      })
    });
    if (resInvalidSig.status !== 400) {
      throw new Error(`Expected 400 for invalid signature, got ${resInvalidSig.status}`);
    }
    const invalidSigData = await resInvalidSig.json();
    if (invalidSigData.code !== 'INVALID_SIGNATURE') {
      throw new Error(`Expected code INVALID_SIGNATURE, got ${invalidSigData.code}`);
    }
    console.log('1.1 Invalid Signature Rejected (Passed)');

    // 1.2 Wrong Buyer JWT
    const resWrongBuyer = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unauthToken}`
      },
      body: JSON.stringify({
        conversation_id: convId,
        offer_id: offerId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature: valid_signature
      })
    });
    if (resWrongBuyer.status !== 403) {
      throw new Error(`Expected 403 for wrong buyer, got ${resWrongBuyer.status}`);
    }
    console.log('1.2 Unauthorized Buyer Rejected with 403 (Passed)');

    // 1.3 Non-existent Conversation
    const resNoConv = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        conversation_id: 99999,
        offer_id: offerId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature: valid_signature
      })
    });
    if (resNoConv.status !== 404) {
      throw new Error(`Expected 404 for non-existent conversation, got ${resNoConv.status}`);
    }
    console.log('1.3 Non-existent Conversation Rejected with 404 (Passed)');

    // 1.4 Success Payment Verification
    const resSuccess = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        conversation_id: convId,
        offer_id: offerId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature: valid_signature
      })
    });
    if (resSuccess.status !== 200) {
      const errTxt = await resSuccess.text();
      throw new Error(`Expected 200 for successful verification, got ${resSuccess.status}. Body: ${errTxt}`);
    }
    const successData = await resSuccess.json();
    if (!successData.order_code.startsWith('TF-')) {
      throw new Error(`Expected order_code starting with TF-, got ${successData.order_code}`);
    }
    if (successData.product_name !== 'Test PO Resin Listing 1') {
      throw new Error(`Expected product_name Test PO Resin Listing 1, got ${successData.product_name}`);
    }
    if (successData.seller_name !== 'Test PO Shop') {
      throw new Error(`Expected seller_name Test PO Shop, got ${successData.seller_name}`);
    }
    if (successData.amount_paid !== 350) {
      throw new Error(`Expected amount_paid 350, got ${successData.amount_paid}`);
    }
    if (successData.delivery_date !== '2026-07-30') {
      throw new Error(`Expected delivery_date 2026-07-30, got ${successData.delivery_date}`);
    }
    if (successData.status !== 'in_production') {
      throw new Error(`Expected status in_production, got ${successData.status}`);
    }
    if (successData.customization_summary.customText !== 'Initials RK') {
      throw new Error(`Expected customization_summary customText Initials RK, got ${JSON.stringify(successData.customization_summary)}`);
    }

    const order_code = successData.order_code;
    console.log(`1.4 Payment Verification Successful. Generated Order Code: ${order_code} (Passed)`);

    // Verify DB states
    const dbOffer = db.prepare("SELECT status FROM custom_offers WHERE id = ?").get(offerId);
    if (dbOffer.status !== 'accepted') {
      throw new Error(`Expected custom_offer status to be accepted, got ${dbOffer.status}`);
    }
    const dbConv = db.prepare("SELECT status FROM conversations WHERE id = ?").get(convId);
    if (dbConv.status !== 'completed') {
      throw new Error(`Expected conversation status to be completed, got ${dbConv.status}`);
    }
    const dbOrder = db.prepare("SELECT * FROM orders WHERE order_ref = ?").get(order_code);
    if (!dbOrder || dbOrder.status !== 'in_production') {
      throw new Error(`Expected order status in_production, got ${dbOrder ? dbOrder.status : 'null'}`);
    }
    const dbNotif = db.prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'payment_received' ORDER BY id DESC LIMIT 1").get(sellerId);
    if (!dbNotif || !dbNotif.message.includes(order_code)) {
      throw new Error(`Expected notification to contain order_code, got ${dbNotif ? dbNotif.message : 'null'}`);
    }
    console.log('Database verification of accepted custom offer, completed conversation, and seller notification (Passed)');

    // 1.5 Duplicate Payment Prevention
    const resDuplicate = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        conversation_id: convId,
        offer_id: offerId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature: valid_signature
      })
    });
    if (resDuplicate.status !== 400) {
      throw new Error(`Expected 400 for duplicate payment verification, got ${resDuplicate.status}`);
    }
    const duplicateData = await resDuplicate.json();
    if (duplicateData.code !== 'PAYMENT_ALREADY_PROCESSED') {
      throw new Error(`Expected code PAYMENT_ALREADY_PROCESSED, got ${duplicateData.code}`);
    }
    console.log('1.5 Duplicate Payment Prevention (Passed)');


    // ==========================================
    // TEST 2: GET /api/orders/:order_code
    // ==========================================
    console.log('\n--- Test 2: Fetching Order & Timeline ---');

    // 2.1 Unauthorized fetch (another user)
    const resGetUnauth = await fetch(`${baseUrl}/api/orders/${order_code}`, {
      headers: { 'Authorization': `Bearer ${unauthToken}` }
    });
    if (resGetUnauth.status !== 403) {
      throw new Error(`Expected 403 for unauthorized order fetch, got ${resGetUnauth.status}`);
    }
    console.log('2.1 Unauthorized Fetch Blocked with 403 (Passed)');

    // 2.2 Invalid Order Code
    const resGetNotFound = await fetch(`${baseUrl}/api/orders/TF-99999999-9999`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    if (resGetNotFound.status !== 404) {
      throw new Error(`Expected 404 for invalid order code, got ${resGetNotFound.status}`);
    }
    console.log('2.2 Invalid Order Code returns 404 (Passed)');

    // 2.3 Successful Fetch (Buyer) & Timeline check
    const resGetBuyer = await fetch(`${baseUrl}/api/orders/${order_code}`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    if (resGetBuyer.status !== 200) {
      throw new Error(`Expected 200, got ${resGetBuyer.status}`);
    }
    const orderDetails = await resGetBuyer.json();
    if (orderDetails.order_code !== order_code) {
      throw new Error(`Expected order_code ${order_code}, got ${orderDetails.order_code}`);
    }
    if (orderDetails.timeline.length !== 3) {
      throw new Error(`Expected timeline length 3, got ${orderDetails.timeline.length}`);
    }
    
    // Check timeline steps at in_production status
    const [t1, t2, t3] = orderDetails.timeline;
    if (t1.step !== 'payment_received' || t1.status !== 'done' || !t1.at) {
      throw new Error(`Invalid timeline step 1: ${JSON.stringify(t1)}`);
    }
    if (t2.step !== 'in_production' || t2.status !== 'active' || !t2.description.includes('Test PO Resin Listing 1')) {
      throw new Error(`Invalid timeline step 2: ${JSON.stringify(t2)}`);
    }
    if (t3.step !== 'dispatched' || t3.status !== 'upcoming') {
      throw new Error(`Invalid timeline step 3: ${JSON.stringify(t3)}`);
    }
    console.log('2.3 Successful Fetch and in_production timeline verified (Passed)');


    // ==========================================
    // TEST 3: PATCH /api/orders/:order_code/status
    // ==========================================
    console.log('\n--- Test 3: Status Transition and Tracking URL Checks ---');

    // 3.1 Non-seller tries to update status
    const resPatchUnauth = await fetch(`${baseUrl}/api/orders/${order_code}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ status: 'dispatched', tracking_url: 'https://shipment.com/track/123' })
    });
    if (resPatchUnauth.status !== 403) {
      throw new Error(`Expected 403 for non-seller updating status, got ${resPatchUnauth.status}`);
    }
    console.log('3.1 Non-seller Status Update Blocked (Passed)');

    // 3.2 Update to dispatched without tracking_url
    const resPatchNoTrack = await fetch(`${baseUrl}/api/orders/${order_code}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ status: 'dispatched' })
    });
    if (resPatchNoTrack.status !== 400) {
      throw new Error(`Expected 400 for dispatching without tracking_url, got ${resPatchNoTrack.status}`);
    }
    console.log('3.2 Missing tracking_url validation (Passed)');

    // 3.3 Update to dispatched with invalid tracking_url format
    const resPatchBadTrack = await fetch(`${baseUrl}/api/orders/${order_code}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ status: 'dispatched', tracking_url: 'not-a-valid-url' })
    });
    if (resPatchBadTrack.status !== 400) {
      throw new Error(`Expected 400 for invalid tracking_url format, got ${resPatchBadTrack.status}`);
    }
    console.log('3.3 Invalid tracking_url validation (Passed)');

    // 3.4 Valid transition to dispatched
    const tracking_url = 'https://shipment.com/track/123';
    const resPatchSuccess = await fetch(`${baseUrl}/api/orders/${order_code}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ status: 'dispatched', tracking_url })
    });
    if (resPatchSuccess.status !== 200) {
      throw new Error(`Expected 200, got ${resPatchSuccess.status}`);
    }
    const patchData = await resPatchSuccess.json();
    if (patchData.status !== 'dispatched') {
      throw new Error(`Expected patched status dispatched, got ${patchData.status}`);
    }
    console.log('3.4 Valid transition to dispatched (Passed)');

    // Verify timeline updates for dispatched
    const resGetBuyerDispatched = await fetch(`${baseUrl}/api/orders/${order_code}`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const orderDetailsDisp = await resGetBuyerDispatched.json();
    const [d1, d2, d3] = orderDetailsDisp.timeline;
    if (d2.status !== 'done') {
      throw new Error(`Expected in_production to be done, got ${d2.status}`);
    }
    if (d3.status !== 'active' || d3.description !== `Track here: ${tracking_url}`) {
      throw new Error(`Expected dispatched step to be active and contain tracking url, got ${JSON.stringify(d3)}`);
    }
    
    // Verify notification for buyer
    const dbNotifDisp = db.prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'order_dispatched' ORDER BY id DESC LIMIT 1").get(buyerId);
    if (!dbNotifDisp || !dbNotifDisp.message.includes(tracking_url)) {
      throw new Error('Expected order_dispatched notification containing tracking url');
    }
    console.log('Timeline and notification for dispatched verified (Passed)');

    // 3.5 Trying to move backward (dispatched -> in_production)
    const resPatchBackward = await fetch(`${baseUrl}/api/orders/${order_code}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ status: 'in_production' })
    });
    if (resPatchBackward.status !== 400) {
      throw new Error(`Expected 400 for backward transition, got ${resPatchBackward.status}`);
    }
    console.log('3.5 Backward transition rejected (Passed)');

    // 3.6 Valid transition to delivered
    const resPatchDelivered = await fetch(`${baseUrl}/api/orders/${order_code}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ status: 'delivered' })
    });
    if (resPatchDelivered.status !== 200) {
      throw new Error(`Expected 200, got ${resPatchDelivered.status}`);
    }
    console.log('3.6 Valid transition to delivered (Passed)');

    // Verify timeline updates for delivered
    const resGetBuyerDelivered = await fetch(`${baseUrl}/api/orders/${order_code}`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const orderDetailsDel = await resGetBuyerDelivered.json();
    const [l1, l2, l3] = orderDetailsDel.timeline;
    if (l2.status !== 'done') {
      throw new Error(`Expected in_production to be done, got ${l2.status}`);
    }
    if (l3.status !== 'done' || l3.description !== 'Delivered') {
      throw new Error(`Expected dispatched step to be done and description Delivered, got ${JSON.stringify(l3)}`);
    }

    // Verify notification for buyer
    const dbNotifDel = db.prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'order_delivered' ORDER BY id DESC LIMIT 1").get(buyerId);
    if (!dbNotifDel || !dbNotifDel.message.includes('delivered')) {
      throw new Error('Expected order_delivered notification');
    }
    console.log('Timeline and notification for delivered verified (Passed)');

    // 3.7 Trying to move backward from delivered
    const resPatchBackwardDel = await fetch(`${baseUrl}/api/orders/${order_code}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ status: 'dispatched', tracking_url })
    });
    if (resPatchBackwardDel.status !== 400) {
      throw new Error(`Expected 400 for backward transition from delivered, got ${resPatchBackwardDel.status}`);
    }
    console.log('3.7 Backward transition from delivered rejected (Passed)');

    console.log('\n✅ ALL PAYMENT VERIFICATION & ORDER MANAGEMENT BACKEND TESTS PASSED!');
  } catch (err) {
    console.error('\n❌ Tests failed:', err.stack);
    exitCode = 1;
  } finally {
    console.log('--- Cleaning up database ---');
    try {
      db.prepare("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_po_%')").run();
      db.prepare("DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE product_type_tag = 'test_po_resin')").run();
      db.prepare("DELETE FROM custom_offers WHERE conversation_id IN (SELECT id FROM conversations WHERE product_type_tag = 'test_po_resin')").run();
      db.prepare("DELETE FROM orders WHERE conversation_id IN (SELECT id FROM conversations WHERE product_type_tag = 'test_po_resin')").run();
      db.prepare("DELETE FROM conversations WHERE product_type_tag = 'test_po_resin'").run();
      db.prepare("DELETE FROM listings WHERE title LIKE 'Test PO%'").run();
      db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_po_%')").run();
      db.prepare("DELETE FROM users WHERE email LIKE 'test_po_%'").run();
    } catch (e) {
      console.error('Failed to clean up:', e.message);
    }
    server.close(() => {
      console.log('Server closed.');
      process.exit(exitCode);
    });
  }
}

setTimeout(runTests, 300);
