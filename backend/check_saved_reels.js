const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'tohfa.db'));

console.log('--- Users ---');
const users = db.prepare("SELECT id, email, role FROM users").all();
console.log(users);

console.log('\n--- Reels ---');
const reels = db.prepare("SELECT id, caption FROM reels").all();
console.log(reels);

console.log('\n--- Saved Reels ---');
const saved = db.prepare("SELECT * FROM saved_reels").all();
console.log(saved);
