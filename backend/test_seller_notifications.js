process.env.PORT = '5007';
const { app, server } = require('./src/server.js');
const db = require('./src/db.js');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5007;
const baseUrl = 'http://localhost:' + PORT;
const JWT_SECRET = process.env.JWT_SECRET || 'tohfa_super_secret_key_987654321';

async function runTests() {
  let exitCode = 0;
  try {
    console.log('--- Cleaning up database ---');
    db.prepare("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_notif_%')").run();
    db.prepare("DELETE FROM intake_question_templates WHERE seller_id IN (SELECT id FROM users WHERE email LIKE 'test_notif_%')").run();
    db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_notif_%')").run();
    db.prepare("DELETE FROM users WHERE email LIKE 'test_notif_%'").run();

    console.log('--- Seeding test database ---');
    // 1. Seller User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_notif_seller@test.com', 'hash', 'Test Seller', 'seller')
    `).run();
    const sellerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Seller Profile
    db.prepare(`
      INSERT INTO seller_profiles (user_id, shop_name, is_approved)
      VALUES (?, 'Test Seller Shop', 1)
    `).run(sellerId);

    // 2. Another Seller User (for boundary tests)
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_notif_seller2@test.com', 'hash', 'Test Seller 2', 'seller')
    `).run();
    const sellerId2 = db.prepare("SELECT last_insert_rowid() as id").get().id;

    db.prepare(`
      INSERT INTO seller_profiles (user_id, shop_name, is_approved)
      VALUES (?, 'Test Seller Shop 2', 1)
    `).run(sellerId2);

    // 3. Buyer User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_notif_buyer@test.com', 'hash', 'Test Buyer', 'buyer')
    `).run();
    const buyerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Generate JWT tokens
    const sellerToken = jwt.sign({ user_id: sellerId, email: 'test_notif_seller@test.com', role: 'seller' }, JWT_SECRET);
    const sellerToken2 = jwt.sign({ user_id: sellerId2, email: 'test_notif_seller2@test.com', role: 'seller' }, JWT_SECRET);
    const buyerToken = jwt.sign({ user_id: buyerId, email: 'test_notif_buyer@test.com', role: 'buyer' }, JWT_SECRET);

    // ==========================================
    // TEST 1: GET Custom Questions
    // ==========================================
    console.log('--- Test 1: GET platform defaults + custom questions ---');
    const getRes = await fetch(`${baseUrl}/api/seller/intake-questions`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    if (getRes.status !== 200) throw new Error(`Expected 200, got ${getRes.status}`);
    const getData = await getRes.json();
    if (!getData.questions || !Array.isArray(getData.questions)) {
      throw new Error("Expected questions array in response");
    }
    // Verify default questions exist
    const defaultQuestions = getData.questions.filter(q => q.is_tohfa_default);
    if (defaultQuestions.length === 0) {
      throw new Error("Platform defaults should be returned");
    }
    console.log('GET Custom Questions: Success (Passed)');

    // ==========================================
    // TEST 2: POST Custom Question
    // ==========================================
    console.log('--- Test 2: POST custom question & validations ---');
    // 2.1 Valid single_choice question
    const postRes1 = await fetch(`${baseUrl}/api/seller/intake-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({
        product_type_tag: 'resin_art',
        question_text: 'Choose color palette',
        answer_type: 'single_choice',
        options: ['Ocean Blue', 'Emerald Green', 'Rose Gold']
      })
    });
    if (postRes1.status !== 200) {
      const errBody = await postRes1.text();
      throw new Error(`Expected 200 for valid single_choice, got ${postRes1.status}. Body: ${errBody}`);
    }
    const postData1 = await postRes1.json();
    if (!postData1.created || !postData1.question_id) throw new Error("Response should indicate created: true with question_id");
    const qId1 = postData1.question_id;

    // 2.2 Invalid single_choice options (less than 2)
    const postResInvalid = await fetch(`${baseUrl}/api/seller/intake-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({
        product_type_tag: 'resin_art',
        question_text: 'Choose color',
        answer_type: 'single_choice',
        options: ['Only One']
      })
    });
    if (postResInvalid.status !== 400) throw new Error(`Expected 400 for 1 option single_choice, got ${postResInvalid.status}`);

    // 2.3 Non-single_choice options should reset options to null
    const postRes2 = await fetch(`${baseUrl}/api/seller/intake-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({
        product_type_tag: 'resin_art',
        question_text: 'Describe design requirements',
        answer_type: 'free_text',
        options: ['Some Option']
      })
    });
    if (postRes2.status !== 200) throw new Error(`Expected 200, got ${postRes2.status}`);
    const postData2 = await postRes2.json();
    const qId2 = postData2.question_id;

    // Verify qId2 has options as null in GET response
    const getResUpdated = await fetch(`${baseUrl}/api/seller/intake-questions`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    const updatedData = await getResUpdated.json();
    const createdQ2 = updatedData.questions.find(q => q.id === qId2);
    if (!createdQ2 || createdQ2.options !== null) {
      throw new Error(`Expected non-single_choice question to have options = null, got ${JSON.stringify(createdQ2)}`);
    }

    // Check display_order is incremented properly
    const maxOrderBefore = db.prepare("SELECT COALESCE(MAX(display_order), 0) AS max_order FROM intake_question_templates WHERE (is_tohfa_default = 1 OR seller_id = ?) AND product_type_tag = 'resin_art'").get(sellerId).max_order;
    const postResOrder = await fetch(`${baseUrl}/api/seller/intake-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({
        product_type_tag: 'resin_art',
        question_text: 'Custom Order question',
        answer_type: 'number'
      })
    });
    const orderData = await postResOrder.json();
    const orderQ = db.prepare("SELECT display_order FROM intake_question_templates WHERE id = ?").get(orderData.question_id);
    if (orderQ.display_order !== maxOrderBefore + 1) {
      throw new Error(`Expected display_order ${maxOrderBefore + 1}, got ${orderQ.display_order}`);
    }

    // 2.4 Max 5 custom questions per product_type_tag limit verification
    // We already have 3 custom questions for 'resin_art'. Let's add 2 more to hit 5, then try to add a 6th.
    for (let i = 0; i < 2; i++) {
      const res = await fetch(`${baseUrl}/api/seller/intake-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sellerToken}`
        },
        body: JSON.stringify({
          product_type_tag: 'resin_art',
          question_text: `Extra Question ${i}`,
          answer_type: 'free_text'
        })
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    }

    // Adding 6th custom question for 'resin_art'
    const postResLimitExceeded = await fetch(`${baseUrl}/api/seller/intake-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({
        product_type_tag: 'resin_art',
        question_text: '6th custom question',
        answer_type: 'free_text'
      })
    });
    if (postResLimitExceeded.status !== 400) {
      throw new Error(`Expected 400 LIMIT_EXCEEDED, got ${postResLimitExceeded.status}`);
    }
    const limitBody = await postResLimitExceeded.json();
    if (limitBody.code !== 'LIMIT_EXCEEDED') {
      throw new Error(`Expected LIMIT_EXCEEDED code, got ${limitBody.code}`);
    }
    console.log('POST Custom Questions: Limit 5 and validation guards passed (Passed)');

    // ==========================================
    // TEST 3: PATCH Custom Questions
    // ==========================================
    console.log('--- Test 3: PATCH custom questions ---');
    // 3.1 Try to patch platform default question (should fail 403)
    const defaultQ = defaultQuestions[0];
    const patchDefaultRes = await fetch(`${baseUrl}/api/seller/intake-questions/${defaultQ.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ question_text: 'Hacked Text' })
    });
    if (patchDefaultRes.status !== 403) throw new Error(`Expected 403 for default question patch, got ${patchDefaultRes.status}`);

    // 3.2 Try to patch other seller's question (should fail 403)
    const patchOtherRes = await fetch(`${baseUrl}/api/seller/intake-questions/${qId1}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken2}`
      },
      body: JSON.stringify({ question_text: 'Hacked Text' })
    });
    if (patchOtherRes.status !== 403) throw new Error(`Expected 403 for other seller question patch, got ${patchOtherRes.status}`);

    // 3.3 Successful update of own question
    const patchResSuccess = await fetch(`${baseUrl}/api/seller/intake-questions/${qId1}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({
        question_text: 'Updated color palette',
        options: ['Ocean Blue', 'Emerald Green', 'Rose Gold', 'Sunset Orange'],
        is_active: false
      })
    });
    if (patchResSuccess.status !== 200) throw new Error(`Expected 200, got ${patchResSuccess.status}`);
    
    // Verify changes
    const updatedQ = db.prepare("SELECT * FROM intake_question_templates WHERE id = ?").get(qId1);
    if (updatedQ.question_text !== 'Updated color palette' || updatedQ.is_active !== 0) {
      throw new Error(`Failed to update fields in DB: ${JSON.stringify(updatedQ)}`);
    }
    const parsedOpts = JSON.parse(updatedQ.options);
    if (!parsedOpts.includes('Sunset Orange')) throw new Error("Options update failed");
    console.log('PATCH Custom Questions: Guard and update checks passed (Passed)');

    // ==========================================
    // TEST 4: GET Notifications (combined + filters + schema)
    // ==========================================
    console.log('--- Test 4: GET notifications (filters & keys) ---');
    // Let's seed 5 notifications for the buyer (3 unread, 2 read)
    db.prepare("DELETE FROM notifications WHERE user_id = ?").run(buyerId);
    
    // 4.1 Insert unread notifications with conversation_id, offer_id, order_code
    db.prepare(`
      INSERT INTO notifications (user_id, type, message, is_read, conversation_id, offer_id, order_code, created_at)
      VALUES (?, 'offer_received', 'New Offer', 0, 101, 201, NULL, datetime('now', '-5 minutes'))
    `).run(buyerId);
    db.prepare(`
      INSERT INTO notifications (user_id, type, message, is_read, conversation_id, offer_id, order_code, created_at)
      VALUES (?, 'order_shipped', 'Order Shipped', 0, NULL, NULL, 'OD-TEST-999', datetime('now', '-10 minutes'))
    `).run(buyerId);
    db.prepare(`
      INSERT INTO notifications (user_id, type, message, is_read, conversation_id, offer_id, order_code, created_at)
      VALUES (?, 'review_request', 'Review Request', 0, NULL, NULL, NULL, datetime('now', '-15 minutes'))
    `).run(buyerId);
    
    // 4.2 Insert read notifications
    db.prepare(`
      INSERT INTO notifications (user_id, type, message, is_read, conversation_id, offer_id, order_code, created_at)
      VALUES (?, 'promo', 'Promo message', 1, NULL, NULL, NULL, datetime('now', '-20 minutes'))
    `).run(buyerId);
    db.prepare(`
      INSERT INTO notifications (user_id, type, message, is_read, conversation_id, offer_id, order_code, created_at)
      VALUES (?, 'review_liked', 'Review Liked', 1, NULL, NULL, NULL, datetime('now', '-25 minutes'))
    `).run(buyerId);

    // 4.3 GET all notifications
    const getNotifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    if (getNotifRes.status !== 200) throw new Error(`Expected 200, got ${getNotifRes.status}`);
    const getNotifData = await getNotifRes.json();
    
    // Test combined structure
    if (getNotifData.unread_count !== 3) throw new Error(`Expected unread_count 3, got ${getNotifData.unread_count}`);
    if (getNotifData.notifications.length !== 5) throw new Error(`Expected 5 notifications, got ${getNotifData.notifications.length}`);
    if (!getNotifData.data || getNotifData.data.unread_count !== 3) throw new Error("Nested data.unread_count missing or wrong");

    // Test fields presence
    const n1 = getNotifData.notifications.find(n => n.type === 'offer_received');
    if (!n1 || n1.conversation_id !== 101 || n1.offer_id !== 201) {
      throw new Error(`Expected conversation_id and offer_id present in notification, got: ${JSON.stringify(n1)}`);
    }
    const n2 = getNotifData.notifications.find(n => n.type === 'order_shipped');
    if (!n2 || n2.order_code !== 'OD-TEST-999') {
      throw new Error(`Expected order_code OD-TEST-999, got: ${JSON.stringify(n2)}`);
    }

    // 4.4 Test unread_only filter
    const getUnreadNotifRes = await fetch(`${baseUrl}/api/notifications?unread_only=true`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const getUnreadNotifData = await getUnreadNotifRes.json();
    if (getUnreadNotifData.notifications.length !== 3) {
      throw new Error(`Expected 3 unread notifications, got ${getUnreadNotifData.notifications.length}`);
    }
    if (getUnreadNotifData.notifications.some(n => n.is_read)) {
      throw new Error("Unread only filter returned a read notification");
    }

    // 4.5 Test limit filter
    const getLimitNotifRes = await fetch(`${baseUrl}/api/notifications?limit=2`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const getLimitNotifData = await getLimitNotifRes.json();
    if (getLimitNotifData.notifications.length !== 2) {
      throw new Error(`Expected limit of 2, got ${getLimitNotifData.notifications.length}`);
    }
    console.log('GET Notifications: Filters, limit, and combined envelope verified (Passed)');

    // ==========================================
    // TEST 5: PATCH Mark Notifications as Read
    // ==========================================
    console.log('--- Test 5: PATCH mark notifications as read ---');
    // Fetch unread notification IDs
    const unreadIds = getUnreadNotifData.notifications.map(n => n.id);
    const idToMark = unreadIds[0];
    const remainingIds = unreadIds.slice(1);

    // 5.1 Mark single ID
    const markSingleRes = await fetch(`${baseUrl}/api/notifications/mark-read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ notification_ids: [idToMark] })
    });
    if (markSingleRes.status !== 200) throw new Error(`Expected 200, got ${markSingleRes.status}`);
    const markSingleData = await markSingleRes.json();
    if (markSingleData.marked_read !== 1) throw new Error(`Expected marked_read 1, got ${markSingleData.marked_read}`);

    // Verify it is read in DB
    const dbNotif1 = db.prepare("SELECT is_read FROM notifications WHERE id = ?").get(idToMark);
    if (dbNotif1.is_read !== 1) throw new Error("Notification was not marked as read in database");

    // 5.2 Try to mark other user's notification (should not update, return marked_read: 0)
    const markOtherRes = await fetch(`${baseUrl}/api/notifications/mark-read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ notification_ids: remainingIds })
    });
    if (markOtherRes.status !== 200) throw new Error(`Expected 200, got ${markOtherRes.status}`);
    const markOtherData = await markOtherRes.json();
    if (markOtherData.marked_read !== 0) {
      throw new Error(`Seller should not be able to mark buyer notifications, got marked_read: ${markOtherData.marked_read}`);
    }

    // 5.3 Mark all remaining
    const markAllRes = await fetch(`${baseUrl}/api/notifications/mark-read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ all: true })
    });
    if (markAllRes.status !== 200) throw new Error(`Expected 200, got ${markAllRes.status}`);
    const markAllData = await markAllRes.json();
    if (markAllData.marked_read !== 2) throw new Error(`Expected marked_read 2, got ${markAllData.marked_read}`);

    // Verify unread count is 0
    const finalUnreadCount = db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0").get(buyerId).count;
    if (finalUnreadCount !== 0) throw new Error(`Expected 0 unread notifications left, got ${finalUnreadCount}`);
    console.log('PATCH Notifications: Specific list & all notifications marking passed (Passed)');

    console.log('✅ ALL SELLER CUSTOM QUESTIONS & NOTIFICATIONS TESTS PASSED!');
  } catch (err) {
    console.error('❌ Tests failed:', err.stack);
    exitCode = 1;
  } finally {
    console.log('--- Cleaning up database ---');
    try {
      db.prepare("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_notif_%')").run();
      db.prepare("DELETE FROM intake_question_templates WHERE seller_id IN (SELECT id FROM users WHERE email LIKE 'test_notif_%')").run();
      db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_notif_%')").run();
      db.prepare("DELETE FROM users WHERE email LIKE 'test_notif_%'").run();
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
