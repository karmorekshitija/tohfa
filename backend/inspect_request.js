const http = require('http');

http.get('http://localhost:5000/api/sellers/210', (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', res.headers);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('BODY:', data);
  });
}).on('error', err => {
  console.error('Error:', err.message);
});
