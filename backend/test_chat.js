// Test script for Customize Feature Live Chat and Status Transitions
process.env.PORT = '5003';
const { app, server } = require('./src/server.js');
const db = require('./src/db.js');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 5003;
const baseUrl = 'http://localhost:' + PORT;
const JWT_SECRET = process.env.JWT_SECRET || 'tohfa_super_secret_key_987654321';

async function runTests() {
  let exitCode = 0;
  try {
    console.log('--- Cleaning up database ---');
    db.prepare("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_chat_%')").run();
    db.prepare("DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE product_type_tag = 'test_chat_resin')").run();
    db.prepare("DELETE FROM conversations WHERE product_type_tag = 'test_chat_resin'").run();
    db.prepare("DELETE FROM listings WHERE title LIKE 'Test Chat Resin%'").run();
    db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_chat_%')").run();
    db.prepare("DELETE FROM users WHERE email LIKE 'test_chat_%'").run();

    console.log('--- Seeding test database ---');
    
    // 1. Seller User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_chat_seller@test.com', 'hash', 'Test Chat Seller', 'seller')
    `).run();
    const sellerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Seller Profile
    db.prepare(`
      INSERT INTO seller_profiles (user_id, shop_name, is_approved)
      VALUES (?, 'Test Chat Shop', 1)
    `).run(sellerId);

    // 2. Buyer User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_chat_buyer@test.com', 'hash', 'Test Chat Buyer', 'buyer')
    `).run();
    const buyerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // 3. Unauthorized User (Another Buyer)
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_chat_unauth@test.com', 'hash', 'Test Chat Unauth', 'buyer')
    `).run();
    const unauthId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // 4. Custom listing
    db.prepare(`
      INSERT INTO listings (seller_id, title, category, base_price, ships_in_days, listing_type, status)
      VALUES (?, 'Test Chat Resin Listing 1', 'resin_art', 50000, 5, 'custom', 'active')
    `).run(sellerId);
    const listingId1 = db.prepare("SELECT last_insert_rowid() as id").get().id;

    db.prepare(`
      INSERT INTO listings (seller_id, title, category, base_price, ships_in_days, listing_type, status)
      VALUES (?, 'Test Chat Resin Listing 2', 'resin_art', 60000, 5, 'custom', 'active')
    `).run(sellerId);
    const listingId2 = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // 5. Generate JWT tokens
    const buyerToken = jwt.sign({ user_id: buyerId, email: 'test_chat_buyer@test.com', role: 'buyer' }, JWT_SECRET);
    const sellerToken = jwt.sign({ user_id: sellerId, email: 'test_chat_seller@test.com', role: 'seller' }, JWT_SECRET);
    const unauthToken = jwt.sign({ user_id: unauthId, email: 'test_chat_unauth@test.com', role: 'buyer' }, JWT_SECRET);

    // 6. Conversations
    // Conversation 1: awaiting_seller
    db.prepare(`
      INSERT INTO conversations (seller_id, buyer_id, listing_id, status, intake_complete, intake_summary, product_type_tag, created_at, updated_at)
      VALUES (?, ?, ?, 'awaiting_seller', 1, '{"some":"summary"}', 'test_chat_resin', datetime('now', '-2 minutes'), datetime('now', '-2 minutes'))
    `).run(sellerId, buyerId, listingId1);
    const convId1 = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Conversation 2: intake_in_progress
    db.prepare(`
      INSERT INTO conversations (seller_id, buyer_id, listing_id, status, intake_complete, intake_summary, product_type_tag, created_at, updated_at)
      VALUES (?, ?, ?, 'intake_in_progress', 0, NULL, 'test_chat_resin', datetime('now', '-1 minute'), datetime('now', '-1 minute'))
    `).run(sellerId, buyerId, listingId1);
    const convId2 = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Conversation 3: closed
    db.prepare(`
      INSERT INTO conversations (seller_id, buyer_id, listing_id, status, intake_complete, intake_summary, product_type_tag, created_at, updated_at)
      VALUES (?, ?, ?, 'closed', 1, '{"some":"summary"}', 'test_chat_resin', datetime('now'), datetime('now'))
    `).run(sellerId, buyerId, listingId2);
    const convId3 = db.prepare("SELECT last_insert_rowid() as id").get().id;

    console.log(`Seeded conversations: Conv1 (ID: ${convId1}), Conv2 (ID: ${convId2}), Conv3 (ID: ${convId3})`);

    // --- TEST 1: Access Guards ---
    console.log('--- Test 1: Access Guards ---');
    // Unauthorized user accessing Conv 1 GET
    const getResUnauth = await fetch(`${baseUrl}/api/conversations/${convId1}`, {
      headers: { 'Authorization': `Bearer ${unauthToken}` }
    });
    if (getResUnauth.status !== 403) throw new Error(`Expected 403 for unauthorized GET conversation, got ${getResUnauth.status}`);
    console.log('GET conversation unauthorized: 403 Forbidden (Passed)');

    // Unauthorized user accessing Conv 1 intake-summary GET
    const intakeResUnauth = await fetch(`${baseUrl}/api/conversations/${convId1}/intake-summary`, {
      headers: { 'Authorization': `Bearer ${unauthToken}` }
    });
    if (intakeResUnauth.status !== 403) throw new Error(`Expected 403 for unauthorized GET intake-summary, got ${intakeResUnauth.status}`);
    console.log('GET intake-summary unauthorized: 403 Forbidden (Passed)');

    // Unauthorized user sending message
    const postResUnauth = await fetch(`${baseUrl}/api/conversations/${convId1}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unauthToken}`
      },
      body: JSON.stringify({ content: 'Hello' })
    });
    if (postResUnauth.status !== 403) throw new Error(`Expected 403 for unauthorized POST messages, got ${postResUnauth.status}`);
    console.log('POST message unauthorized: 403 Forbidden (Passed)');

    // Non-existent conversation
    const nonExistentRes = await fetch(`${baseUrl}/api/conversations/999999`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    if (nonExistentRes.status !== 404) throw new Error(`Expected 404 for non-existent conversation, got ${nonExistentRes.status}`);
    console.log('GET non-existent conversation: 404 Not Found (Passed)');


    // --- TEST 2: Automatic Status Transitions ---
    console.log('--- Test 2: Automatic Status Transitions ---');
    // Buyer loads conversation details (should remain awaiting_seller)
    const getResBuyerBefore = await fetch(`${baseUrl}/api/conversations/${convId1}`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const dataBuyerBefore = await getResBuyerBefore.json();
    if (dataBuyerBefore.status !== 'awaiting_seller') {
      throw new Error(`Expected status to remain awaiting_seller for buyer load, got ${dataBuyerBefore.status}`);
    }
    console.log('Buyer load did not transition status (Passed)');

    // Seller loads conversation details (should transition to live)
    const getResSeller = await fetch(`${baseUrl}/api/conversations/${convId1}`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    if (getResSeller.status !== 200) throw new Error(`Expected 200, got ${getResSeller.status}`);
    const dataSeller = await getResSeller.json();
    if (dataSeller.status !== 'live') {
      throw new Error(`Expected status to transition to live for seller load, got ${dataSeller.status}`);
    }
    console.log('Seller load successfully transitioned status to live (Passed)');

    // Verify DB update
    const dbConv1 = db.prepare("SELECT status FROM conversations WHERE id = ?").get(convId1);
    if (dbConv1.status !== 'live') {
      throw new Error(`Database status for Conv 1 expected live, got ${dbConv1.status}`);
    }
    console.log('Database status verified as live (Passed)');


    // --- TEST 3: Message Rejection during Intake ---
    console.log('--- Test 3: Message Rejection during Intake ---');
    const intakeMsgRes = await fetch(`${baseUrl}/api/conversations/${convId2}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ content: 'Hello bot' })
    });
    if (intakeMsgRes.status !== 400) throw new Error(`Expected 400 for message during intake phase, got ${intakeMsgRes.status}`);
    const intakeMsgData = await intakeMsgRes.json();
    if (intakeMsgData.code !== 'INTAKE_IN_PROGRESS') {
      throw new Error(`Expected code INTAKE_IN_PROGRESS, got ${intakeMsgData.code}`);
    }
    console.log('Message during intake correctly rejected (Passed)');


    // --- TEST 4: Message Sending & Notification ---
    console.log('--- Test 4: Message Sending & Notification ---');
    // Send text message as buyer
    const sendResBuyer = await fetch(`${baseUrl}/api/conversations/${convId1}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ content: 'I want a customized keychain' })
    });
    if (sendResBuyer.status !== 200) throw new Error(`Expected 200, got ${sendResBuyer.status}`);
    const sendDataBuyer = await sendResBuyer.json();
    if (!sendDataBuyer.message_id) throw new Error('Missing message_id in response');
    if (sendDataBuyer.conversation_status !== 'live') throw new Error(`Expected status live, got ${sendDataBuyer.conversation_status}`);
    console.log('Buyer sent text message successfully (Passed)');

    // Verify message was stored in DB
    const dbMsg = db.prepare("SELECT * FROM conversation_messages WHERE id = ?").get(sendDataBuyer.message_id);
    if (!dbMsg) throw new Error('Message not stored in database');
    if (dbMsg.sender_role !== 'buyer') throw new Error(`Expected sender_role buyer, got ${dbMsg.sender_role}`);
    if (dbMsg.message_type !== 'text') throw new Error(`Expected message_type text, got ${dbMsg.message_type}`);
    if (dbMsg.content !== 'I want a customized keychain') throw new Error('Message content mismatch');
    console.log('Message DB fields verified (Passed)');

    // Verify notification was created for seller
    const dbNotification = db.prepare("SELECT * FROM notifications WHERE conversation_id = ? ORDER BY id DESC LIMIT 1").get(convId1);
    if (!dbNotification) throw new Error('Notification not created');
    if (dbNotification.user_id !== sellerId) throw new Error('Notification recipient is not the seller');
    if (dbNotification.type !== 'new_message') throw new Error(`Expected type new_message, got ${dbNotification.type}`);
    console.log('Notification for seller verified (Passed)');

    // Send empty text message as buyer (should be rejected)
    const sendEmptyRes = await fetch(`${baseUrl}/api/conversations/${convId1}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ content: '  ' })
    });
    if (sendEmptyRes.status !== 400) throw new Error(`Expected 400 for empty message content, got ${sendEmptyRes.status}`);
    console.log('Empty text message correctly rejected (Passed)');


    // --- TEST 5: Photo Message Sending & Validation ---
    console.log('--- Test 5: Photo Message Sending & Validation ---');
    // Helper to send multipart request
    async function sendMultipartMessage(cId, token, filename, dataBuffer) {
      const boundary = '----WebKitFormBoundaryTestChat';
      const header = `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`;
      const footer = `\r\n--${boundary}--\r\n`;

      const bodyBuffer = Buffer.concat([
        Buffer.from(header),
        dataBuffer,
        Buffer.from(footer)
      ]);

      const response = await fetch(`${baseUrl}/api/conversations/${cId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: bodyBuffer
      });
      return response;
    }

    // 5.1 Invalid extension (.txt)
    const txtRes = await sendMultipartMessage(convId1, buyerToken, 'chat.txt', Buffer.from('dummy-txt'));
    if (txtRes.status !== 400) throw new Error(`Txt upload should return 400, got ${txtRes.status}`);
    console.log('Txt file upload for chat message rejected (Passed)');

    // 5.2 Exceeds 5MB size
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');
    const largeRes = await sendMultipartMessage(convId1, buyerToken, 'large.png', largeBuffer);
    if (largeRes.status !== 400) throw new Error(`6MB image upload should return 400, got ${largeRes.status}`);
    console.log('6MB image upload for chat message rejected (Passed)');

    // 5.3 Valid image upload
    const validImageRes = await sendMultipartMessage(convId1, buyerToken, 'valid_chat.png', Buffer.from('dummy-image-bytes'));
    if (validImageRes.status !== 200) throw new Error(`Valid image upload should return 200, got ${validImageRes.status}`);
    const validImageData = await validImageRes.json();
    if (!validImageData.message_id) throw new Error('Expected message_id for valid photo message');
    
    // Verify file exists
    const chatMsgDb = db.prepare("SELECT * FROM conversation_messages WHERE id = ?").get(validImageData.message_id);
    if (chatMsgDb.message_type !== 'photo') throw new Error('Expected message_type photo');
    if (!chatMsgDb.image_url.startsWith('/uploads/chat/')) throw new Error(`Invalid image_url path: ${chatMsgDb.image_url}`);
    
    const absolutePath = path.join(__dirname, chatMsgDb.image_url);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Uploaded file does not exist at ${absolutePath}`);
    }
    console.log('Valid photo message uploaded and stored correctly (Passed)');


    // --- TEST 6: Listing Conversations & Pagination ---
    console.log('--- Test 6: Listing Conversations & Pagination ---');
    // Get conversations for buyer
    const listRes = await fetch(`${baseUrl}/api/conversations?limit=10&page=1`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    if (listRes.status !== 200) throw new Error(`Expected 200, got ${listRes.status}`);
    const listData = await listRes.json();
    
    if (!listData.conversations || listData.conversations.length < 2) {
      throw new Error(`Expected at least 2 conversations, got ${listData.conversations ? listData.conversations.length : 0}`);
    }

    const c1 = listData.conversations.find(c => c.conversation_id === convId1);
    if (!c1) throw new Error('Conv 1 not found in conversation list');
    if (c1.status !== 'live') throw new Error(`Expected live status, got ${c1.status}`);
    if (c1.product_name !== 'Test Chat Resin Listing 1') throw new Error(`Expected product_name Test Chat Resin Listing 1, got ${c1.product_name}`);
    if (c1.last_message_preview !== '[Photo]') throw new Error(`Expected last_message_preview [Photo], got ${c1.last_message_preview}`);
    
    console.log('Conversation list items formatted correctly (Passed)');

    // Test Pagination Limit
    const page1Res = await fetch(`${baseUrl}/api/conversations?limit=1&page=1`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const page1Data = await page1Res.json();
    if (page1Data.conversations.length !== 1) {
      throw new Error(`Expected 1 conversation per page, got ${page1Data.conversations.length}`);
    }

    const page2Res = await fetch(`${baseUrl}/api/conversations?limit=1&page=2`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const page2Data = await page2Res.json();
    if (page2Data.conversations.length !== 1) {
      throw new Error(`Expected 1 conversation on page 2, got ${page2Data.conversations.length}`);
    }

    if (page1Data.conversations[0].conversation_id === page2Data.conversations[0].conversation_id) {
      throw new Error('Pagination page 1 and page 2 returned the same conversation');
    }
    console.log('Pagination limit and page parameters work correctly (Passed)');


    // --- TEST 7: Intake Summary GET ---
    console.log('--- Test 7: Intake Summary GET ---');
    const summaryRes = await fetch(`${baseUrl}/api/conversations/${convId1}/intake-summary`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    if (summaryRes.status !== 200) throw new Error(`Expected 200, got ${summaryRes.status}`);
    const summaryData = await summaryRes.json();
    if (summaryData.intake_summary.some !== 'summary') {
      throw new Error('Intake summary JSON parsing or content mismatch');
    }
    console.log('GET intake-summary endpoint returned successfully (Passed)');

    console.log('✅ ALL LIVE CHAT BACKEND TESTS PASSED!');
  } catch (err) {
    console.error('❌ Tests failed:', err.stack);
    exitCode = 1;
  } finally {
    console.log('--- Cleaning up database ---');
    try {
      db.prepare("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_chat_%')").run();
      db.prepare("DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE product_type_tag = 'test_chat_resin')").run();
      db.prepare("DELETE FROM conversations WHERE product_type_tag = 'test_chat_resin'").run();
      db.prepare("DELETE FROM listings WHERE title LIKE 'Test Chat Resin%'").run();
      db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_chat_%')").run();
      db.prepare("DELETE FROM users WHERE email LIKE 'test_chat_%'").run();
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
