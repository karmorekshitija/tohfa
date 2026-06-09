const Database = require('better-sqlite3');
const db = new Database('./tohfa.db');

console.log('\n--- Categories ---');
console.log(db.prepare('SELECT id, name, slug FROM categories').all());

console.log('\n--- Sellers ---');
console.log(db.prepare("SELECT id, email, full_name, role FROM users WHERE role = 'seller'").all());

console.log('\n--- Existing Reels ---');
console.log(db.prepare('SELECT id, seller_id, product_id, caption, video_url, thumbnail_url FROM reels').all());

console.log('\n--- Products ---');
console.log(db.prepare('SELECT * FROM products LIMIT 2').all());

console.log('\n--- Product Images ---');
console.log(db.prepare('SELECT * FROM product_images LIMIT 5').all());
