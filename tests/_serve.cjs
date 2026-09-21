// servidor estático da raiz do repo, com a URL do banco trocada por uma falsa (os testes interceptam fake-db)
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
module.exports = port => http.createServer((q, r) => {
  let file = q.url.split('?')[0].split('#')[0]; if (file === '/') file = '/index.html';
  const abs = path.join(ROOT, file); if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) { r.statusCode = 404; return r.end(); }
  r.setHeader('Content-Type', TYPES[path.extname(abs)] || 'application/octet-stream');
  if (file === '/app.js') return r.end(fs.readFileSync(abs, 'utf8').replace(/const DB = '[^']*';/, "const DB = 'https://fake-db.firebaseio.com';"));
  r.end(fs.readFileSync(abs));
}).listen(port);
