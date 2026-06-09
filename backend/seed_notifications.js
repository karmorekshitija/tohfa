const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'tohfa.db');
const db = new Database(dbPath);

const buyers = db.prepare("SELECT id FROM users WHERE role = 'buyer'").all();
const buyerIds = buyers.map(b => b.id);

console.log('Seeding dummy notifications for buyer IDs:', buyerIds);

try {
  db.prepare('BEGIN TRANSACTION').run();

  // Clear existing notifications for these users to make it clean
  if (buyerIds.length > 0) {
    const placeholders = buyerIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM notifications WHERE user_id IN (${placeholders})`).run(...buyerIds);
  }

  const insertStmt = db.prepare(`
    INSERT INTO notifications (user_id, type, icon, message, is_read, created_at, link_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  const fiveHoursAgo = new Date(now - 5 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  const oneDayAgo = new Date(now - 26 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  const twoDaysAgo = new Date(now - 50 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

  for (const userId of buyerIds) {
    // 1. Unread order shipped (Today, 2 hours ago)
    insertStmt.run(
      userId,
      'order_shipped',
      'package_2',
      'Your handcrafted Terracotta Vase has bloomed! It has been shipped and is on its way to you.',
      0, // is_read = 0
      twoHoursAgo,
      '/buyer/orders.html'
    );

    // 2. Read review liked (Today, 5 hours ago)
    insertStmt.run(
      userId,
      'review_liked',
      'favorite',
      "Aria Studio loved your review on the 'Silk Weaver' collection.",
      1, // is_read = 1
      fiveHoursAgo,
      '/buyer/profile.html'
    );

    // 3. Read review request (Earlier, yesterday)
    insertStmt.run(
      userId,
      'review_request',
      'star',
      'How is your Cedarwood Incense? Leave a sprig of a review to help other artisans.',
      1, // is_read = 1
      oneDayAgo,
      '/buyer/orders.html'
    );

    // 4. Unread promo (Earlier, yesterday)
    insertStmt.run(
      userId,
      'promo',
      'local_florist',
      'A new season begins: Explore the Monsoon Garden limited artisan drop.',
      0, // is_read = 0
      twoDaysAgo,
      '/buyer/categories.html'
    );
  }

  db.prepare('COMMIT').run();
  console.log('Successfully seeded dummy notifications for user IDs:', buyerIds);
} catch (err) {
  db.prepare('ROLLBACK').run();
  console.error('Failed to seed notifications:', err);
}
