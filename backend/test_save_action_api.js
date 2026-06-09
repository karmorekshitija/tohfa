const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tohfa_super_secret_key_987654321';

// Generate a valid token for user 153 (email: shyamsagarkar@gmail.com, role: buyer)
const token = jwt.sign(
  { user_id: 153, email: 'shyamsagarkar@gmail.com', role: 'buyer' },
  JWT_SECRET,
  { expiresIn: '15m' }
);

// We will save reel 83, then check if it works
fetch('http://localhost:5000/api/reels/83/save', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`
  }
})
.then(res => res.json().then(data => {
  console.log('POST Response Status:', res.status);
  console.log('POST Response Data:', JSON.stringify(data, null, 2));

  // Now query saved reels to see if 83 is there
  return fetch('http://localhost:5000/api/reels/saved', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}))
.then(res => res.json().then(data => {
  console.log('GET Response Status:', res.status);
  console.log('GET Response Data:', JSON.stringify(data, null, 2));
}))
.catch(err => {
  console.error('Error:', err.message);
});
