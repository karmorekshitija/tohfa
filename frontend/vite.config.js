import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

function getHtmlEntries(dir, list = {}) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && !file.startsWith('.')) {
        getHtmlEntries(filePath, list);
      }
    } else if (file.endsWith('.html')) {
      const relative = path.relative(__dirname, filePath).replace(/\\/g, '/');
      const name = relative.replace(/\.html$/, '').replace(/\//g, '_');
      list[name] = resolve(__dirname, relative);
    }
  }
  return list;
}

const entries = getHtmlEntries(__dirname);

export default defineConfig({
  build: {
    rollupOptions: {
      input: entries
    }
  },
  server: {
    allowedHosts: ['quotes-webcams-captured-penetration.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      },
      '/media': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
