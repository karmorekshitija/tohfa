const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'bg_texture.jpg');
const destPath = 'C:\\Users\\ACER\\.gemini\\antigravity\\brain\\018423a4-e8ae-4dde-aeb4-836e03948425\\bg_texture.jpg';

try {
  fs.copyFileSync(srcPath, destPath);
  console.log('Copied bg_texture.jpg to artifacts folder successfully.');
} catch (err) {
  console.error('Error copying file:', err.message);
}
