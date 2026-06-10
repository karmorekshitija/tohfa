// Integration test script for Customize Feature Final Flow
process.env.PORT = '5005';
require('dotenv').config();

const { app, server } = require('./src/server.js');
const db = require('./src/db.js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const PORT = process.env.PORT || 5005;
const baseUrl = 'http://localhost:' + PORT;
const JWT_SECRET = process.env.JWT_SECRET || 'tohfa_super_secret_key_987654321';

async function sendMultipartRequest(convId, qId, filename, dataBuffer, token) {
  const boundary = '----WebKitFormBoundaryTestFinal';
  const header1 = `--${boundary}\r\nContent-Disposition: form-data; name="question_id"\r\n\r\n${qId}\r\n`;
  const header2 = `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const bodyBuffer = Buffer.concat([
    Buffer.from(header1),
    Buffer.from(header2),
    dataBuffer,
    Buffer.from(footer)
  ]);

  const response = await fetch(`${baseUrl}/api/conversations/${convId}/answer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: bodyBuffer
  });
  return response;
}

async function runTests() {
  let exitCode = 0;
  try {
    const buyerEmail = 'test_final_buyer@test.com';
    const sellerEmail = 'test_final_seller@test.com';

    console.log('--- Step 1: Cleaning up database ---');
    db.prepare("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email IN (?, ?))").run(buyerEmail, sellerEmail);
    db.prepare("DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE buyer_id IN (SELECT id FROM users WHERE email = ?))").run(buyerEmail);
    db.prepare("DELETE FROM custom_offers WHERE buyer_id IN (SELECT id FROM users WHERE email = ?)").run(buyerEmail);
    db.prepare("DELETE FROM orders WHERE buyer_id IN (SELECT id FROM users WHERE email = ?)").run(buyerEmail);
    db.prepare("DELETE FROM conversations WHERE buyer_id IN (SELECT id FROM users WHERE email = ?)").run(buyerEmail);
    db.prepare("DELETE FROM listings WHERE seller_id IN (SELECT id FROM users WHERE email = ?)").run(sellerEmail);
    db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email = ?)").run(sellerEmail);
    db.prepare("DELETE FROM users WHERE email IN (?, ?)").run(buyerEmail, sellerEmail);

    console.log('--- Seeding test database ---');
    // 1. Seller User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES (?, 'hash', 'Test Final Seller', 'seller')
    `).run(sellerEmail);
    const sellerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Approved Seller Profile
    db.prepare(`
      INSERT INTO seller_profiles (user_id, shop_name, is_approved)
      VALUES (?, 'Test Final Shop', 1)
    `).run(sellerId);

    // 2. Buyer User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES (?, 'hash', 'Test Final Buyer', 'buyer')
    `).run(buyerEmail);
    const buyerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // 3. Custom listing with category/tag 'resin_art' and listings.listing_type = 'custom'
    db.prepare(`
      INSERT INTO listings (seller_id, title, category, base_price, ships_in_days, listing_type, status)
      VALUES (?, 'Custom Resin Coaster', 'resin_art', 60000, 7, 'custom', 'active')
    `).run(sellerId);
    const listingId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Generate JWT tokens
    const buyerToken = jwt.sign({ user_id: buyerId, email: buyerEmail, role: 'buyer' }, JWT_SECRET);
    const sellerToken = jwt.sign({ user_id: sellerId, email: sellerEmail, role: 'seller' }, JWT_SECRET);

    console.log(`Seeded: Seller ${sellerId}, Buyer ${buyerId}, Listing ${listingId}`);

    // --- Happy Path sequential flow ---

    // A. POST /api/conversations
    console.log('\n--- Step A: POST /api/conversations ---');
    const startRes = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ listing_id: listingId, product_type_tag: 'resin_art' })
    });
    if (startRes.status !== 200 && startRes.status !== 201) {
      throw new Error(`A: POST /api/conversations failed: ${startRes.status}`);
    }
    const startData = await startRes.json();
    const conversationId = startData.conversation_id;
    console.log('Conversation started, ID:', conversationId);

    // B. Loop to get and answer all questions
    console.log('\n--- Step B: Answering all questions ---');
    for (let i = 0; i < 6; i++) {
      const qRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/next-question`, {
        headers: { 'Authorization': `Bearer ${buyerToken}` }
      });
      if (qRes.status !== 200) {
        throw new Error(`B: GET next-question failed at index ${i}: ${qRes.status}`);
      }
      const qData = await qRes.json();
      if (qData.done) {
        console.log(`Intake questions marked done at index ${i}`);
        break;
      }
      const q = qData.question;
      console.log(`Fetching Question ${i + 1}: [${q.answer_type}] ${q.question_text}`);

      let ansRes;
      if (q.answer_type === 'photo_upload') {
        ansRes = await sendMultipartRequest(conversationId, q.id, 'image.png', Buffer.from('dummy-image-data'), buyerToken);
      } else {
        let val = 'Test Answer';
        if (q.answer_type === 'date_picker') {
          val = '2027-12-25'; // Must be future
        } else if (q.answer_type === 'single_choice') {
          const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
          val = opts[0];
        }
        ansRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${buyerToken}`
          },
          body: JSON.stringify({ question_id: q.id, answer_value: val })
        });
      }

      if (ansRes.status !== 200) {
        throw new Error(`B: POST answer failed for question ${q.id}: ${ansRes.status} - ${await ansRes.text()}`);
      }
      const ansData = await ansRes.json();
      console.log(`Answer submitted. Count: ${ansData.answered_count}/${ansData.total_questions}`);
    }

    // C. POST /api/conversations/:id/complete-intake
    console.log('\n--- Step C: POST /api/conversations/:id/complete-intake ---');
    const completeRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/complete-intake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      }
    });
    if (completeRes.status !== 200) {
      throw new Error(`C: POST /api/conversations/:id/complete-intake failed: ${completeRes.status}`);
    }
    const completeData = await completeRes.json();
    console.log('Intake completed. Status:', completeData.conversation_status);

    // D. POST /api/conversations/:id/messages (seller replies, shifting status to 'live')
    console.log('\n--- Step D: POST /api/conversations/:id/messages (Seller reply) ---');
    const msgRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ content: 'Sure, I can customize this for you!' })
    });
    if (msgRes.status !== 200 && msgRes.status !== 201) {
      throw new Error(`D: POST /api/conversations/:id/messages failed: ${msgRes.status}`);
    }
    const msgData = await msgRes.json();
    console.log('Message sent. Conversation status:', msgData.conversation_status);

    // E. POST /api/conversations/:id/offer (seller sends a price quote)
    console.log('\n--- Step E: POST /api/conversations/:id/offer (Seller sends quote) ---');
    const offerRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({
        price: 600, // INR
        delivery_date: '2027-12-31',
        seller_notes: 'Includes custom colors and engravings.'
      })
    });
    if (offerRes.status !== 200 && offerRes.status !== 201) {
      throw new Error(`E: POST /api/conversations/:id/offer failed: ${offerRes.status}`);
    }
    const offerData = await offerRes.json();
    const offerId = offerData.offer_id || (offerData.offer && offerData.offer.id);
    console.log(`Offer sent, ID: ${offerId}. Conversation status: ${offerData.conversation_status}`);

    // F. POST /api/conversations/:id/offer/:offer_id/respond (buyer accepts offer, generates Razorpay order details)
    console.log('\n--- Step F: POST /api/conversations/:id/offer/:offer_id/respond (Accept Offer) ---');
    const respondRes = await fetch(`${baseUrl}/api/conversations/${conversationId}/offer/${offerId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ action: 'accept' })
    });
    if (respondRes.status !== 200) {
      throw new Error(`F: POST respond failed: ${respondRes.status} - ${await respondRes.text()}`);
    }
    const respondData = await respondRes.json();
    const razorpayOrderId = respondData.razorpay_order_id;
    console.log(`Offer accepted, Razorpay Order ID: ${razorpayOrderId}`);

    // G. POST /api/payments/verify (buyer verifies payment and creates the custom order)
    console.log('\n--- Step G: POST /api/payments/verify ---');
    const resVerify = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        offer_id: offerId,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: 'pay_dummy123',
        razorpay_signature: 'mock_signature'
      })
    });
    if (resVerify.status !== 200) {
      throw new Error(`G: POST /api/payments/verify failed: ${resVerify.status} - ${await resVerify.text()}`);
    }
    const verifyData = await resVerify.json();
    const orderCode = verifyData.order_code;
    console.log(`Payment verified. Created Order Code: ${orderCode}`);

    // H. GET /api/orders/:order_code (buyer fetches order details and timeline)
    console.log('\n--- Step H: GET /api/orders/:order_code ---');
    const orderRes = await fetch(`${baseUrl}/api/orders/${orderCode}`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    if (orderRes.status !== 200) {
      throw new Error(`H: GET /api/orders/:order_code failed: ${orderRes.status}`);
    }
    const orderData = await orderRes.json();
    console.log(`Order details fetched successfully for code: ${orderData.order_code}`);
    console.log(`Timeline status check:`);
    orderData.timeline.forEach(step => {
      console.log(`  - [${step.step}] label: ${step.label}, status: ${step.status}, at: ${step.at}`);
    });

    console.log('\nFULL FLOW OK\n');

    // Print Endpoint Table
    console.log('METHOD | PATH                                           | PURPOSE                                                  | AUTH REQUIRED');
    console.log('-------|------------------------------------------------|----------------------------------------------------------|--------------');
    console.log('GET    | /api/customizations/tags                       | Returns distinct tags for active customization services  | No');
    console.log('GET    | /api/customizations                            | Returns paginated list of customizable listings          | No');
    console.log('GET    | /api/customizations/:listing_id                 | Returns full detail for one customization service        | No');
    console.log('POST   | /api/conversations                             | Starts bot intake flow / creates conversation            | Yes (Buyer)');
    console.log('GET    | /api/conversations/:id/next-question           | Returns the next unanswered question or done signal      | Yes (Buyer)');
    console.log('POST   | /api/conversations/:id/answer                  | Submits an answer to the current bot question            | Yes (Buyer)');
    console.log('POST   | /api/conversations/:id/complete-intake         | Compiles responses, marks complete, and notifies seller  | Yes (Buyer)');
    console.log('GET    | /api/conversations/:id                         | Loads the full conversation for the chat screen          | Yes (Buyer/Seller)');
    console.log('GET    | /api/conversations/:id/intake-summary          | Returns only the intake_summary JSON for a conversation   | Yes (Buyer/Seller)');
    console.log('POST   | /api/conversations/:id/messages                | Sends a live chat message (buyer or seller)              | Yes (Buyer/Seller)');
    console.log('GET    | /api/conversations                             | Lists all conversations for the logged-in user           | Yes (Buyer/Seller)');
    console.log('POST   | /api/conversations/:id/offer                   | Seller creates and sends a price offer/quote             | Yes (Seller)');
    console.log('GET    | /api/conversations/:id/offer                   | Gets latest custom offer for a conversation              | Yes (Buyer/Seller)');
    console.log('POST   | /api/conversations/:id/offer/:offer_id/respond | Buyer accepts or declines the custom offer               | Yes (Buyer)');
    console.log('POST   | /api/payments/verify                           | Verifies custom offer payment and creates orders         | Yes (Buyer)');
    console.log('GET    | /api/orders/:order_code                        | Returns full custom order detail and timeline            | Yes (Buyer/Seller)');
    console.log('PATCH  | /api/orders/:order_code/status                 | Seller updates custom order status / tracking            | Yes (Seller)');
    console.log('GET    | /api/seller/intake-questions                   | Returns platform defaults + seller custom questions      | Yes (Seller)');
    console.log('POST   | /api/seller/intake-questions                   | Seller adds custom intake question                       | Yes (Seller)');
    console.log('PATCH  | /api/seller/intake-questions/:question_id      | Seller updates/deactivates custom question               | Yes (Seller)');
    console.log('GET    | /api/notifications                             | Returns recent notifications for user                    | Yes');
    console.log('PATCH  | /api/notifications/mark-read                   | Mark notifications as read                               | Yes');

  } catch (err) {
    console.error('❌ Integration check failed:', err.stack);
    exitCode = 1;
  } finally {
    console.log('--- Cleaning up database ---');
    try {
      const buyerEmail = 'test_final_buyer@test.com';
      const sellerEmail = 'test_final_seller@test.com';
      db.prepare("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email IN (?, ?))").run(buyerEmail, sellerEmail);
      db.prepare("DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE buyer_id IN (SELECT id FROM users WHERE email = ?))").run(buyerEmail);
      db.prepare("DELETE FROM custom_offers WHERE buyer_id IN (SELECT id FROM users WHERE email = ?)").run(buyerEmail);
      db.prepare("DELETE FROM orders WHERE buyer_id IN (SELECT id FROM users WHERE email = ?)").run(buyerEmail);
      db.prepare("DELETE FROM conversations WHERE buyer_id IN (SELECT id FROM users WHERE email = ?)").run(buyerEmail);
      db.prepare("DELETE FROM listings WHERE seller_id IN (SELECT id FROM users WHERE email = ?)").run(sellerEmail);
      db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email = ?)").run(sellerEmail);
      db.prepare("DELETE FROM users WHERE email IN (?, ?)").run(buyerEmail, sellerEmail);
    } catch (e) {
      console.error('Failed to clean up:', e.message);
    }
    server.close(() => {
      console.log('Server closed.');
      process.exit(exitCode);
    });
  }
}

setTimeout(runTests, 500);
