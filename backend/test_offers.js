process.env.PORT = '5004';
const { app, server } = require('./src/server.js');
const db = require('./src/db.js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const PORT = process.env.PORT || 5004;
const baseUrl = 'http://localhost:' + PORT;
const JWT_SECRET = process.env.JWT_SECRET || 'tohfa_super_secret_key_987654321';

async function runTests() {
  let exitCode = 0;
  try {
    console.log('--- Cleaning up database ---');
    db.prepare("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_offer_%')").run();
    db.prepare("DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE product_type_tag = 'test_offer_resin')").run();
    db.prepare("DELETE FROM custom_offers WHERE conversation_id IN (SELECT id FROM conversations WHERE product_type_tag = 'test_offer_resin')").run();
    db.prepare("DELETE FROM conversations WHERE product_type_tag = 'test_offer_resin'").run();
    db.prepare("DELETE FROM listings WHERE title LIKE 'Test Offer Resin%'").run();
    db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_offer_%')").run();
    db.prepare("DELETE FROM users WHERE email LIKE 'test_offer_%'").run();

    console.log('--- Seeding test database ---');
    // 1. Seller User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_offer_seller@test.com', 'hash', 'Test Offer Seller', 'seller')
    `).run();
    const sellerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Seller Profile
    db.prepare(`
      INSERT INTO seller_profiles (user_id, shop_name, is_approved)
      VALUES (?, 'Test Offer Shop', 1)
    `).run(sellerId);

    // 2. Buyer User
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_offer_buyer@test.com', 'hash', 'Test Offer Buyer', 'buyer')
    `).run();
    const buyerId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // 3. Unauthorized User (Another Buyer)
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ('test_offer_unauth@test.com', 'hash', 'Test Offer Unauth', 'buyer')
    `).run();
    const unauthId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // 4. Custom listing
    db.prepare(`
      INSERT INTO listings (seller_id, title, category, base_price, ships_in_days, listing_type, status)
      VALUES (?, 'Test Offer Resin Listing 1', 'resin_art', 50000, 5, 'custom', 'active')
    `).run(sellerId);
    const listingId1 = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // 5. Generate JWT tokens
    const buyerToken = jwt.sign({ user_id: buyerId, email: 'test_offer_buyer@test.com', role: 'buyer' }, JWT_SECRET);
    const sellerToken = jwt.sign({ user_id: sellerId, email: 'test_offer_seller@test.com', role: 'seller' }, JWT_SECRET);
    const unauthToken = jwt.sign({ user_id: unauthId, email: 'test_offer_unauth@test.com', role: 'buyer' }, JWT_SECRET);

    // 6. Conversations
    // Conversation 1: live
    db.prepare(`
      INSERT INTO conversations (seller_id, buyer_id, listing_id, status, intake_complete, intake_summary, product_type_tag, created_at, updated_at)
      VALUES (?, ?, ?, 'live', 1, '{"some":"summary"}', 'test_offer_resin', datetime('now'), datetime('now'))
    `).run(sellerId, buyerId, listingId1);
    const convId1 = db.prepare("SELECT last_insert_rowid() as id").get().id;

    // Conversation 2: intake_in_progress (invalid status for offers)
    db.prepare(`
      INSERT INTO conversations (seller_id, buyer_id, listing_id, status, intake_complete, intake_summary, product_type_tag, created_at, updated_at)
      VALUES (?, ?, ?, 'intake_in_progress', 0, NULL, 'test_offer_resin', datetime('now'), datetime('now'))
    `).run(sellerId, buyerId, listingId1);
    const convId2 = db.prepare("SELECT last_insert_rowid() as id").get().id;

    console.log(`Seeded conversations: Conv1 (ID: ${convId1}), Conv2 (ID: ${convId2})`);

    // ==========================================
    // TEST 1: Creating custom offers & Validations
    // ==========================================
    console.log('--- Test 1: Creating custom offers & Validations ---');
    
    // 1.1 Auth Guards
    const createResUnauth = await fetch(`${baseUrl}/api/conversations/${convId1}/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}` // must be seller
      },
      body: JSON.stringify({ price: 1500, delivery_date: '2026-07-20' })
    });
    if (createResUnauth.status !== 403) throw new Error(`Expected 403 for buyer trying to create offer, got ${createResUnauth.status}`);
    console.log('Auth Guard: Buyer rejected with 403 (Passed)');

    // 1.2 Conversation status checks (convId2 is intake_in_progress)
    const createResInvalidStatus = await fetch(`${baseUrl}/api/conversations/${convId2}/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ price: 1500, delivery_date: '2026-07-20' })
    });
    if (createResInvalidStatus.status !== 400) throw new Error(`Expected 400 for conversation in intake_in_progress, got ${createResInvalidStatus.status}`);
    console.log('Validation Guard: Reject offer creation on invalid conversation status (Passed)');

    // 1.3 Validation: price (negative/missing/not integer)
    const createResBadPrice = await fetch(`${baseUrl}/api/conversations/${convId1}/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ price: -100, delivery_date: '2026-07-20' })
    });
    if (createResBadPrice.status !== 400) throw new Error(`Expected 400 for negative price, got ${createResBadPrice.status}`);
    console.log('Validation Guard: Reject negative price (Passed)');

    // 1.4 Validation: delivery_date (past / today)
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const createResPastDate = await fetch(`${baseUrl}/api/conversations/${convId1}/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ price: 1500, delivery_date: todayStr })
    });
    if (createResPastDate.status !== 400) throw new Error(`Expected 400 for today/past delivery date, got ${createResPastDate.status}`);
    console.log('Validation Guard: Reject past/today delivery date (Passed)');

    // 1.5 Validation: seller_notes too long
    const longNotes = 'a'.repeat(501);
    const createResLongNotes = await fetch(`${baseUrl}/api/conversations/${convId1}/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ price: 1500, delivery_date: '2026-07-20', seller_notes: longNotes })
    });
    if (createResLongNotes.status !== 400) throw new Error(`Expected 400 for too long seller notes, got ${createResLongNotes.status}`);
    console.log('Validation Guard: Reject overlong seller notes (Passed)');

    // 1.6 Successful creation
    const createResSuccess = await fetch(`${baseUrl}/api/conversations/${convId1}/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ price: 1500, delivery_date: '2026-07-20', seller_notes: 'Custom resin design' })
    });
    if (createResSuccess.status !== 200) throw new Error(`Expected 200, got ${createResSuccess.status}`);
    const offerData = await createResSuccess.json();
    if (offerData.price !== 1500) throw new Error(`Expected price 1500, got ${offerData.price}`);
    if (offerData.status !== 'pending') throw new Error(`Expected status pending, got ${offerData.status}`);
    if (offerData.conversation_status !== 'offer_sent') throw new Error(`Expected conversation_status offer_sent, got ${offerData.conversation_status}`);
    const offerId1 = offerData.id;
    console.log('Offer creation successful: offer_sent and fields verified (Passed)');

    // Verify system message inserted
    const dbMsg = db.prepare("SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1").get(convId1);
    if (!dbMsg || dbMsg.content !== 'OFFER_CARD' || dbMsg.message_type !== 'system') {
      throw new Error(`Expected system message content 'OFFER_CARD', got ${dbMsg ? dbMsg.content : 'null'}`);
    }
    console.log('Offer creation system message verified in database (Passed)');

    // Verify notification created for buyer
    const dbNotif = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(buyerId);
    if (!dbNotif || dbNotif.type !== 'offer_received') {
      throw new Error(`Expected notification for buyer of type offer_received, got ${dbNotif ? dbNotif.type : 'null'}`);
    }
    console.log('Offer creation buyer notification verified in database (Passed)');

    // 1.7 Prevent multiple pending offers
    const createResDuplicate = await fetch(`${baseUrl}/api/conversations/${convId1}/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ price: 2000, delivery_date: '2026-07-25' })
    });
    if (createResDuplicate.status !== 409) throw new Error(`Expected 409 for duplicate pending offer, got ${createResDuplicate.status}`);
    const dupData = await createResDuplicate.json();
    if (dupData.code !== 'OFFER_PENDING') throw new Error(`Expected code OFFER_PENDING, got ${dupData.code}`);
    console.log('Single Pending Guard: Duplicate offer creation blocked with 409 OFFER_PENDING (Passed)');


    // ==========================================
    // TEST 2: Fetching offers & Auto-expiry
    // ==========================================
    console.log('--- Test 2: Fetching offers & Auto-expiry ---');

    // 2.1 Fetch offer as buyer
    const getResBuyer = await fetch(`${baseUrl}/api/conversations/${convId1}/offer`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    if (getResBuyer.status !== 200) throw new Error(`Expected 200 for buyer offer fetch, got ${getResBuyer.status}`);
    const getBuyerData = await getResBuyer.json();
    if (!getBuyerData.offer || getBuyerData.offer.id !== offerId1) throw new Error('Fetched offer mismatch');
    if (getBuyerData.offer.hours_remaining < 47 || getBuyerData.offer.hours_remaining > 48) {
      throw new Error(`Expected hours_remaining to be around 48, got ${getBuyerData.offer.hours_remaining}`);
    }
    console.log('GET offer details and hours_remaining verified (Passed)');

    // 2.2 Expiry on GET check
    // Backdate expires_at of offerId1 to the past
    db.prepare("UPDATE custom_offers SET expires_at = ? WHERE id = ?").run(new Date(Date.now() - 3600 * 1000).toISOString(), offerId1);
    
    // Now fetch again, should trigger auto-expiry
    const getResExpired = await fetch(`${baseUrl}/api/conversations/${convId1}/offer`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    if (getResExpired.status !== 200) throw new Error(`Expected 200, got ${getResExpired.status}`);
    const getExpiredData = await getResExpired.json();
    if (getExpiredData.offer.status !== 'expired') throw new Error(`Expected expired status in response, got ${getExpiredData.offer.status}`);
    if (getExpiredData.offer.hours_remaining !== 0) throw new Error(`Expected hours_remaining 0 for expired, got ${getExpiredData.offer.hours_remaining}`);
    
    // Verify DB states
    const dbOfferExpired = db.prepare("SELECT status FROM custom_offers WHERE id = ?").get(offerId1);
    if (dbOfferExpired.status !== 'expired') throw new Error(`Expected DB offer status to be expired, got ${dbOfferExpired.status}`);
    
    const dbConvExpired = db.prepare("SELECT status FROM conversations WHERE id = ?").get(convId1);
    if (dbConvExpired.status !== 'live') throw new Error(`Expected DB conversation status to reset to live, got ${dbConvExpired.status}`);
    
    const dbMsgExpired = db.prepare("SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1").get(convId1);
    if (dbMsgExpired.content !== 'OFFER_EXPIRED') throw new Error(`Expected system message OFFER_EXPIRED, got ${dbMsgExpired.content}`);
    
    console.log('GET auto-expiry trigger, database updates, system message, and status resets verified (Passed)');


    // ==========================================
    // TEST 3: Responding to offers & Auth
    // ==========================================
    console.log('--- Test 3: Responding to offers & Auth ---');

    // Reset status to live so we can create a new offer
    db.prepare("UPDATE conversations SET status = 'live' WHERE id = ?").run(convId1);

    // Create a new offer for responding
    const createRes2 = await fetch(`${baseUrl}/api/conversations/${convId1}/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ price: 2500, delivery_date: '2026-07-22' })
    });
    const offer2Data = await createRes2.json();
    const offerId2 = offer2Data.id;

    // 3.1 Auth Guard: Seller trying to respond to own offer
    const respondResSeller = await fetch(`${baseUrl}/api/conversations/${convId1}/offer/${offerId2}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ action: 'accept' })
    });
    if (respondResSeller.status !== 403) throw new Error(`Expected 403 for seller trying to respond, got ${respondResSeller.status}`);
    console.log('Respond Guard: Seller rejected with 403 (Passed)');

    // 3.2 Respond Action: Decline
    const respondResDecline = await fetch(`${baseUrl}/api/conversations/${convId1}/offer/${offerId2}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ action: 'decline' })
    });
    if (respondResDecline.status !== 200) throw new Error(`Expected 200 for decline, got ${respondResDecline.status}`);
    const declineData = await respondResDecline.json();
    if (declineData.action !== 'declined') throw new Error(`Expected action declined, got ${declineData.action}`);
    if (declineData.conversation_status !== 'live') throw new Error(`Expected conversation_status live, got ${declineData.conversation_status}`);

    // Verify DB declined states
    const dbOfferDeclined = db.prepare("SELECT status FROM custom_offers WHERE id = ?").get(offerId2);
    if (dbOfferDeclined.status !== 'declined') throw new Error(`Expected DB offer status declined, got ${dbOfferDeclined.status}`);
    
    const dbConvDeclined = db.prepare("SELECT status FROM conversations WHERE id = ?").get(convId1);
    if (dbConvDeclined.status !== 'live') throw new Error(`Expected DB conversation status live, got ${dbConvDeclined.status}`);

    const dbMsgDeclined = db.prepare("SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1").get(convId1);
    if (dbMsgDeclined.content !== 'OFFER_DECLINED') throw new Error(`Expected system message OFFER_DECLINED, got ${dbMsgDeclined.content}`);
    
    const dbNotifDeclined = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(sellerId);
    if (!dbNotifDeclined || dbNotifDeclined.type !== 'offer_declined') {
      throw new Error('Expected notification for seller of type offer_declined');
    }
    console.log('Respond Action: Decline and all corresponding database updates verified (Passed)');

    // 3.3 Respond Action: Accept
    // Create another offer
    const createRes3 = await fetch(`${baseUrl}/api/conversations/${convId1}/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ price: 3000, delivery_date: '2026-07-25' })
    });
    const offer3Data = await createRes3.json();
    const offerId3 = offer3Data.id;

    const respondResAccept = await fetch(`${baseUrl}/api/conversations/${convId1}/offer/${offerId3}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ action: 'accept' })
    });
    if (respondResAccept.status !== 200) throw new Error(`Expected 200 for accept, got ${respondResAccept.status}`);
    const acceptData = await respondResAccept.json();
    if (acceptData.action !== 'accepted') throw new Error(`Expected action accepted, got ${acceptData.action}`);
    if (!acceptData.razorpay_order_id) throw new Error('Expected razorpay_order_id in accept response');
    if (acceptData.amount !== 300000) throw new Error(`Expected amount 300000 paise, got ${acceptData.amount}`);
    if (acceptData.currency !== 'INR') throw new Error(`Expected currency INR, got ${acceptData.currency}`);
    if (!acceptData.key_id) throw new Error('Expected key_id in accept response');

    // Verify DB accepted states
    const dbOfferAccepted = db.prepare("SELECT status FROM custom_offers WHERE id = ?").get(offerId3);
    if (dbOfferAccepted.status !== 'accepted') throw new Error(`Expected DB offer status accepted, got ${dbOfferAccepted.status}`);
    
    const dbConvAccepted = db.prepare("SELECT status FROM conversations WHERE id = ?").get(convId1);
    if (dbConvAccepted.status !== 'completed') throw new Error(`Expected DB conversation status completed, got ${dbConvAccepted.status}`);

    const dbNotifAccepted = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(sellerId);
    if (!dbNotifAccepted || dbNotifAccepted.type !== 'offer_accepted') {
      throw new Error('Expected notification for seller of type offer_accepted');
    }
    console.log('Respond Action: Accept, Razorpay fields, and database updates verified (Passed)');

    // 3.4 Respond: Try to respond to already accepted offer (should fail because not pending)
    const respondResStale = await fetch(`${baseUrl}/api/conversations/${convId1}/offer/${offerId3}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ action: 'decline' })
    });
    if (respondResStale.status !== 400) throw new Error(`Expected 400 for stale offer respond, got ${respondResStale.status}`);
    console.log('Stale Offer Respond Guard: Blocked with 400 (Passed)');


    // ==========================================
    // TEST 4: Background Expiry Checks
    // ==========================================
    console.log('--- Test 4: Background Expiry Checks ---');

    // Reopen conversation status to live
    db.prepare("UPDATE conversations SET status = 'live' WHERE id = ?").run(convId1);

    // Create a new offer
    const createRes4 = await fetch(`${baseUrl}/api/conversations/${convId1}/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ price: 4000, delivery_date: '2026-07-28' })
    });
    const offer4Data = await createRes4.json();
    const offerId4 = offer4Data.id;

    // Backdate expires_at to the past
    db.prepare("UPDATE custom_offers SET expires_at = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), offerId4);

    // Trigger background check via the test endpoint
    const triggerRes = await fetch(`${baseUrl}/api/test/trigger-expiry-check`, {
      method: 'POST'
    });
    if (triggerRes.status !== 200) throw new Error(`Expected 200 from test trigger endpoint, got ${triggerRes.status}`);

    // Verify DB states for offerId4 (should be expired)
    const dbOffer4 = db.prepare("SELECT status FROM custom_offers WHERE id = ?").get(offerId4);
    if (dbOffer4.status !== 'expired') throw new Error(`Expected status expired from background worker, got ${dbOffer4.status}`);

    const dbConv4 = db.prepare("SELECT status FROM conversations WHERE id = ?").get(convId1);
    if (dbConv4.status !== 'live') throw new Error(`Expected conversation status to reset to live, got ${dbConv4.status}`);

    const dbMsg4 = db.prepare("SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1").get(convId1);
    if (dbMsg4.content !== 'OFFER_EXPIRED') throw new Error(`Expected system message OFFER_EXPIRED, got ${dbMsg4.content}`);

    const dbNotif4 = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(buyerId);
    if (!dbNotif4 || dbNotif4.type !== 'offer_expired') {
      throw new Error(`Expected notification type offer_expired, got ${dbNotif4 ? dbNotif4.type : 'null'}`);
    }
    console.log('Background Expiry Worker: Successfully triggered and verified expiry logic (Passed)');

    console.log('✅ ALL CUSTOM OFFERS BACKEND TESTS PASSED!');
  } catch (err) {
    console.error('❌ Tests failed:', err.stack);
    exitCode = 1;
  } finally {
    console.log('--- Cleaning up database ---');
    try {
      db.prepare("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_offer_%')").run();
      db.prepare("DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE product_type_tag = 'test_offer_resin')").run();
      db.prepare("DELETE FROM custom_offers WHERE conversation_id IN (SELECT id FROM conversations WHERE product_type_tag = 'test_offer_resin')").run();
      db.prepare("DELETE FROM conversations WHERE product_type_tag = 'test_offer_resin'").run();
      db.prepare("DELETE FROM listings WHERE title LIKE 'Test Offer Resin%'").run();
      db.prepare("DELETE FROM seller_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_offer_%')").run();
      db.prepare("DELETE FROM users WHERE email LIKE 'test_offer_%'").run();
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
