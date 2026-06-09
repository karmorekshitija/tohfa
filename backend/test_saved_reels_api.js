const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tohfa_super_secret_key_987654321';

// Generate a valid token for user 153 (email: shyamsagarkar@gmail.com, role: buyer)
const token = jwt.sign(
  { user_id: 153, email: 'shyamsagarkar@gmail.com', role: 'buyer' },
  JWT_SECRET,
  { expiresIn: '15m' }
);

console.log('Generated Token:', token);

fetch('http://localhost:5000/api/reels/saved', {
  headers: {
    Authorization: `Bearer ${token}`
  }
})
.then(res => res.json().then(data => {
  console.log('Response Status:', res.status);
  console.log('Response Data:', JSON.stringify(data, null, 2));
}))
.catch(err => {
  console.error('Error:', err.message);
});
