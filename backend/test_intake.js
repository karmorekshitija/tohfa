// Test script for Customize Feature Bot Intake Engine
process.env.PORT = '5002';
const { app, server } = require('./src/server.js');
const db = require('./src/db.js');
const jwt = require('jsonwebtoken');
const path = require('path');

const PORT = process.env.PORT || 5002;
const baseUrl = 'http://localhost:' + PORT;
const JWT_SECRET = process.env.JWT_SECRET || 'tohfa_super_secret_key_987654321';

async function runTests() {
  let exitCode = 0;
  try {
    console.log('--- Cleaning up database ---');
    db.prepare("DELETE FROM notifications WHERE type = 'new_customize_request'").run();
    db.prepare("DELETE FROM intake_responses").run();
    db.prepare("DELETE FROM conversations WHERE product_type_tag = 'resin_art'").run();
    db.prepare("DELETE FROM listings WHERE title = 'Test Intake Resin Listing'").run();
    db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email = 'test_intake_seller@test.com')").run();
    db.prepare("DELETE FROM users WHERE email = 'test_intake_seller@test.com'").run();
    db.prepare("DELETE FROM users WHERE email = 'test_intake_buyer@test.com'").run();

    console.log('--- Seeding test database ---');
    // Seller User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_intake_seller@test.com', 'hash', 'Test Intake Seller', 'seller')
    `).run();
    const sellerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Seller Profile
    db.prepare(`
      INSERT INTO seller_profiles (user_id, shop_name, is_approved)
      VALUES (?, 'Test Intake Shop', 1)
    `).run(sellerId);

    // Buyer User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_intake_buyer@test.com', 'hash', 'Test Intake Buyer', 'buyer')
    `).run();
    const buyerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Custom listing (resin_art)
    db.prepare(`
      INSERT INTO listings (seller_id, title, category, base_price, ships_in_days, listing_type, status)
      VALUES (?, 'Test Intake Resin Listing', 'resin_art', 50000, 5, 'custom', 'active')
    `).run(sellerId);
    const listingId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Generate JWT tokens
    const buyerToken = jwt.sign({ user_id: buyerId, email: 'test_intake_buyer@test.com', role: 'buyer' }, JWT_SECRET);

    // Get all templates for resin_art
    const templates = db.prepare(`
      SELECT * FROM intake_question_templates
      WHERE product_type_tag = 'resin_art' AND is_active = 1
      ORDER BY display_order ASC
    `).all();

    console.log(`Loaded ${templates.length} templates for resin_art`);
    if (templates.length === 0) {
      throw new Error("No default templates seeded for resin_art!");
    }

    // --- TEST 1: POST /api/conversations (Start flow) ---
    console.log('--- Test 1: POST /api/conversations ---');
    const startRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ listing_id: listingId, product_type_tag: 'resin_art' })
    });
    
    if (startRes.status !== 200) throw new Error(`Start conversation expected 200, got ${startRes.status}`);
    const startData = await startRes.json();
    console.log('Start Conversation Response:', startData);
    
    const conversationId = startData.conversation_id;
    if (!conversationId) throw new Error('Missing conversation_id');
    if (startData.existing !== false) throw new Error('Expected existing=false');
    if (startData.intake_complete !== false) throw new Error('Expected intake_complete=false');
    if (startData.question_count !== templates.length) throw new Error(`Expected question_count=${templates.length}, got ${startData.question_count}`);

    // --- TEST 2: POST /api/conversations (Duplicate check) ---
    console.log('--- Test 2: POST /api/conversations (Duplicate Check) ---');
    const dupRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ listing_id: listingId, product_type_tag: 'resin_art' })
    });
    
    if (dupRes.status !== 200) throw new Error(`Dup check expected 200, got ${dupRes.status}`);
    const dupData = await dupRes.json();
    console.log('Dup Response:', dupData);
    if (dupData.conversation_id !== conversationId) throw new Error('Duplicate conversation ID mismatch');
    if (dupData.existing !== true) throw new Error('Expected existing=true');

    // --- TEST 3: GET /api/conversations/:id/next-question ---
    console.log('--- Test 3: GET next-question ---');
    const nextQRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/next-question`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    if (nextQRes.status !== 200) throw new Error(`Next Q expected 200, got ${nextQRes.status}`);
    const nextQData = await nextQRes.json();
    console.log('Next Question Response:', nextQData);
    
    if (nextQData.done !== false) throw new Error('Expected done=false');
    if (!nextQData.question) throw new Error('Expected question object');
    if (nextQData.question.id !== templates[0].id) throw new Error(`Expected question id ${templates[0].id}, got ${nextQData.question.id}`);

    // --- TEST 4: Date Picker Validation (Future only) ---
    console.log('--- Test 4: Date picker future validation ---');
    // Find the date picker question
    const datePickerQ = templates.find(t => t.answer_type === 'date_picker');
    if (!datePickerQ) throw new Error("No date picker question template found!");
    
    // Past date (e.g. 2000-01-01)
    const pastDateRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ question_id: datePickerQ.id, answer_value: '2000-01-01' })
    });
    console.log('Past date submission status:', pastDateRes.status);
    if (pastDateRes.status !== 400) throw new Error(`Past date should return 400, got ${pastDateRes.status}`);
    
    // Today's date is not in the future.
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDateRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ question_id: datePickerQ.id, answer_value: todayStr })
    });
    console.log("Today's date submission status:", todayDateRes.status);
    if (todayDateRes.status !== 400) throw new Error(`Today's date should return 400, got ${todayDateRes.status}`);

    // Future date
    const futureYear = new Date().getFullYear() + 2;
    const futureDateStr = `${futureYear}-12-25`;
    const futureDateRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ question_id: datePickerQ.id, answer_value: futureDateStr })
    });
    console.log('Future date submission status:', futureDateRes.status);
    if (futureDateRes.status !== 200) throw new Error(`Future date should return 200, got ${futureDateRes.status}`);
    const futureDateData = await futureDateRes.json();
    if (!futureDateData.saved) throw new Error('Expected saved=true');

    // --- TEST 5: File size and format constraints ---
    console.log('--- Test 5: File upload validation ---');
    const photoQ = templates.find(t => t.answer_type === 'photo_upload');
    if (!photoQ) throw new Error("No photo upload question template found!");

    // Helper to send multipart request
    async function sendMultipartRequest(qId, filename, dataBuffer) {
      const boundary = '----WebKitFormBoundaryTestIntake';
      const header1 = `--${boundary}\r\nContent-Disposition: form-data; name="question_id"\r\n\r\n${qId}\r\n`;
      const header2 = `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`;
      const footer = `\r\n--${boundary}--\r\n`;

      const bodyBuffer = Buffer.concat([
        Buffer.from(header1),
        Buffer.from(header2),
        dataBuffer,
        Buffer.from(footer)
      ]);

      const response = await fetch(`${baseUrl}/api/conversations/${conversationId}/answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${buyerToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: bodyBuffer
      });
      return response;
    }

    // 5.1 Invalid extension (.txt)
    const txtRes = await sendMultipartRequest(photoQ.id, 'test.txt', Buffer.from('dummy-txt'));
    console.log('Txt file upload status:', txtRes.status);
    if (txtRes.status !== 400) throw new Error(`Txt upload should return 400, got ${txtRes.status}`);
    const txtData = await txtRes.json();
    console.log('Txt upload error response:', txtData);

    // 5.2 Exceeds 5MB size
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');
    const largeRes = await sendMultipartRequest(photoQ.id, 'large.png', largeBuffer);
    console.log('6MB image upload status:', largeRes.status);
    if (largeRes.status !== 400) throw new Error(`6MB image upload should return 400, got ${largeRes.status}`);
    const largeData = await largeRes.json();
    console.log('6MB upload error response:', largeData);

    // 5.3 Valid image upload
    const validImageRes = await sendMultipartRequest(photoQ.id, 'valid.png', Buffer.from('dummy-image-bytes'));
    console.log('Valid image upload status:', validImageRes.status);
    if (validImageRes.status !== 200) throw new Error(`Valid image upload should return 200, got ${validImageRes.status}`);
    const validImageData = await validImageRes.json();
    if (!validImageData.saved) throw new Error('Expected saved=true for valid photo upload');

    // --- TEST 6: Happy path intake questionnaire flow ---
    console.log('--- Test 6: Answering remaining questions ---');
    for (const q of templates) {
      if (q.id === datePickerQ.id || q.id === photoQ.id) {
        continue; // already answered
      }
      
      const answerVal = q.answer_type === 'single_choice' ? JSON.parse(q.options)[0] : 'Test Answer';
      const ansRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${buyerToken}`
        },
        body: JSON.stringify({ question_id: q.id, answer_value: answerVal })
      });
      
      if (ansRes.status !== 200) throw new Error(`Answer question expected 200, got ${ansRes.status}`);
      const ansData = await ansRes.json();
      console.log(`Answered question id ${q.id}:`, ansData);
    }

    // --- TEST 7: Next question call with all questions answered auto-completes ---
    console.log('--- Test 7: GET next-question after all answered (auto-complete) ---');
    const finalNextQRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/next-question`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    if (finalNextQRes.status !== 200) throw new Error(`Final Next Q expected 200, got ${finalNextQRes.status}`);
    const finalNextQData = await finalNextQRes.json();
    console.log('Final Next Question Response:', finalNextQData);
    if (finalNextQData.done !== true) throw new Error('Expected done=true');

    // Verify conversation record
    const updatedConv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
    console.log('Updated Conversation:', updatedConv);
    if (updatedConv.intake_complete !== 1) throw new Error('Expected intake_complete=1');
    if (updatedConv.status !== 'awaiting_seller') throw new Error(`Expected status='awaiting_seller', got ${updatedConv.status}`);
    
    // Check notification
    const notification = db.prepare("SELECT * FROM notifications WHERE conversation_id = ?").get(conversationId);
    console.log('Created Notification:', notification);
    if (!notification) throw new Error('Notification not created');
    if (notification.type !== 'new_customize_request') throw new Error('Notification type mismatch');

    // --- TEST 8: Answering after completion returns 400 ---
    console.log('--- Test 8: Answering after completion ---');
    const afterCompleteRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ question_id: templates[0].id, answer_value: 'New Answer' })
    });
    console.log('After complete answer submission status:', afterCompleteRes.status);
    if (afterCompleteRes.status !== 400) throw new Error(`Answering after completion should return 400, got ${afterCompleteRes.status}`);
    const afterCompleteData = await afterCompleteRes.json();
    console.log('After complete error response:', afterCompleteData);
    if (afterCompleteData.code !== 'INTAKE_DONE') throw new Error(`Expected code='INTAKE_DONE', got ${afterCompleteData.code}`);

    console.log('✅ ALL INTAKE ENGINE BACKEND TESTS PASSED!');
  } catch (err) {
    console.error('❌ Tests failed:', err.stack);
    exitCode = 1;
  } finally {
    console.log('--- Cleaning up database ---');
    try {
      db.prepare("DELETE FROM notifications WHERE type = 'new_customize_request'").run();
      db.prepare("DELETE FROM intake_responses").run();
      db.prepare("DELETE FROM conversations WHERE product_type_tag = 'resin_art'").run();
      db.prepare("DELETE FROM listings WHERE title = 'Test Intake Resin Listing'").run();
      db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email = 'test_intake_seller@test.com')").run();
      db.prepare("DELETE FROM users WHERE email = 'test_intake_seller@test.com'").run();
      db.prepare("DELETE FROM users WHERE email = 'test_intake_buyer@test.com'").run();
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
