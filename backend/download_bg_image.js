const fs = require('fs');
const path = require('path');

const imageUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCL8HlWj3d7Jn4Rr8_Omv5ZuBBtt-PIgqkz6U0QXXzOoK5q0e2iSq3bOoqpTXh2YvRiqLxaCe5OhuMhLl4jceRshlhkOmGhbfFCTjJh3-xwIm5HZjubNr6bGDaUtGGUFXPBbtpSV5Dp4_OnQRqkj_K7lty0Zr5u7smkvT4F08O58kmMBsY6p-pt3_E4nOm_pM_Ea5de71J1n0EgSHpKPNJ7oL5rYlXXv8H9ZKYxP6h94AtGHixEvqCj_3MaC6RC_BwGgTNXM2ZNx-8';

fetch(imageUrl)
.then(res => res.arrayBuffer())
.then(buffer => {
  const destPath = path.join(__dirname, 'bg_texture.jpg');
  fs.writeFileSync(destPath, Buffer.from(buffer));
  console.log('Downloaded image successfully. Size:', buffer.byteLength, 'bytes. Saved to:', destPath);
})
.catch(err => {
  console.error('Error:', err.message);
});
