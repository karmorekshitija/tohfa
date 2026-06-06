// test_task26.js — Task 26: Seller Reviews
const http = require('http');
const db   = require('better-sqlite3')('tohfa.db');

function req(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname:'localhost', port:5000, path, method,
      headers: {
        'Content-Type':'application/json',
        ...(token ? { 'Authorization':'Bearer '+token } : {}),
        ...(data ? { 'Content-Length':Buffer.byteLength(data) } : {})
      }
    };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status:res.statusCode, body:JSON.parse(d) }); } catch(e) { resolve({ status:res.statusCode, body:d }); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let passed = 0, failed = 0;
function assert(label, cond, extra='') {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra?': '+extra:''}`); failed++; }
}

async function run() {
  console.log('\n=== Task 26: Seller Reviews ===\n');

  const sellerUser = db.prepare(
    "SELECT u.email FROM users u JOIN seller_profiles s ON s.user_id = u.id WHERE u.role = 'seller' LIMIT 1"
  ).get();
  if (!sellerUser) { console.error('No seller'); process.exit(1); }
  console.log('  Using seller:', sellerUser.email);

  const loginResp = await req('POST', '/api/auth/login', null, { email:sellerUser.email, password:'password123' });
  assert('Login returns 200', loginResp.status === 200);
  const token = loginResp.body?.data?.access_token;
  assert('Token obtained', !!token);
  if (!token) process.exit(1);

  // ── GET /api/seller/reviews ──
  console.log('\n  [GET /api/seller/reviews]');
  const listResp = await req('GET', '/api/seller/reviews', token, null);
  assert('GET reviews returns 200', listResp.status === 200, `got ${listResp.status}`);

  const d = listResp.body?.data;
  assert('Response has data', !!d);
  assert('reviews is array', Array.isArray(d?.reviews));
  assert('summary object present', typeof d?.summary === 'object');
  assert('avg_rating in summary', 'avg_rating' in (d?.summary || {}));
  assert('total_reviews in summary', 'total_reviews' in (d?.summary || {}));
  assert('pending_replies in summary', 'pending_replies' in (d?.summary || {}));
  assert('response_rate_pct in summary', 'response_rate_pct' in (d?.summary || {}));
  assert('rating_distribution present', typeof d?.summary?.rating_distribution === 'object');

  // Filter: unreplied
  const unrepliedResp = await req('GET', '/api/seller/reviews?filter=unreplied', token, null);
  assert('Filter unreplied returns 200', unrepliedResp.status === 200);
  assert('Filtered reviews is array', Array.isArray(unrepliedResp.body?.data?.reviews));

  // Filter: critical
  const criticalResp = await req('GET', '/api/seller/reviews?filter=critical', token, null);
  assert('Filter critical returns 200', criticalResp.status === 200);

  // Sort variations
  const highestResp = await req('GET', '/api/seller/reviews?sort=highest_rating', token, null);
  assert('Sort highest_rating returns 200', highestResp.status === 200);
  const lowestResp = await req('GET', '/api/seller/reviews?sort=lowest_rating', token, null);
  assert('Sort lowest_rating returns 200', lowestResp.status === 200);

  // ── POST /api/seller/reviews/:id/reply ──
  console.log('\n  [POST /api/seller/reviews/:id/reply]');
  const reviews = d?.reviews || [];

  if (reviews.length > 0) {
    // Find unreplied one first; fallback to first
    const unreplied = reviews.find(r => !r.reply) || reviews[0];
    const reviewId  = unreplied.review_id;
    console.log(`  Using review_id: ${reviewId}`);

    const replyResp = await req('POST', `/api/seller/reviews/${reviewId}/reply`, token, {
      reply_text: 'Thank you so much for your kind review! We appreciate your support.'
    });
    assert('POST reply returns 201', replyResp.status === 201, `got ${replyResp.status} — ${JSON.stringify(replyResp.body).substring(0,200)}`);
    assert('Reply data returned', !!replyResp.body?.data);
    assert('reply_text in response', typeof replyResp.body?.data?.reply?.reply_text === 'string');

    // Empty reply_text rejected
    const emptyReplyResp = await req('POST', `/api/seller/reviews/${reviewId}/reply`, token, { reply_text: '   ' });
    assert('Empty reply returns 400', emptyReplyResp.status === 400, `got ${emptyReplyResp.status}`);

  } else {
    console.log('  ⚠ No reviews in DB — skipping reply test');
  }

  // ── Auth guard ──
  console.log('\n  [Auth guards]');
  const unauthResp = await req('GET', '/api/seller/reviews', null, null);
  assert('Unauthenticated GET returns 401', unauthResp.status === 401);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
