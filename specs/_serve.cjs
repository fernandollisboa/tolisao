const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
module.exports = () => new Promise(ok => {
  const srv = http.createServer((q, r) => {
    let file = q.url.split('?')[0].split('#')[0]; if (file === '/') file = '/index.html';
    const abs = path.join(ROOT, file); if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) { r.statusCode = 404; return r.end(); }
    r.setHeader('Content-Type', TYPES[path.extname(abs)] || 'application/octet-stream');
    // troca o banco de verdade pelo falso; não achou a linha, o app.js nem sai: teste nenhum fala com o firebase de produção
    if (file === '/app.js') { const src = fs.readFileSync(abs, 'utf8'), DB = /const DB = (['"])[^'"]*\1;/;
      if (!DB.test(src)) { r.statusCode = 500; return r.end('_serve.cjs: não achei a linha `const DB = ...` no app.js'); }
      return r.end(src.replace(DB, "const DB = 'https://fake-db.firebaseio.com';")); }
    r.end(fs.readFileSync(abs));
  }).listen(0, () => ok({ srv, porta: (srv.address()).port }));
});
