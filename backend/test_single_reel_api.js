const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tohfa_super_secret_key_987654321';
const token = jwt.sign(
  { user_id: 153, email: 'shyamsagarkar@gmail.com', role: 'buyer' },
  JWT_SECRET,
  { expiresIn: '15m' }
);

fetch('http://localhost:5000/api/reels/83', {
  headers: {
    Authorization: `Bearer ${token}`
  }
})
.then(res => res.json().then(data => {
  console.log('GET Response Status:', res.status);
  console.log('GET Response Data:', JSON.stringify(data, null, 2));
}))
.catch(err => {
  console.error('Error:', err.message);
});
