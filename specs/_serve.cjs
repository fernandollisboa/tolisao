const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
// a API falsa (_api.cjs); a CSP do index.html troca a de verdade por ela, senão o navegador barrava
const API_FALSA = 'https://fake-api.tolisa.test';
module.exports = () => new Promise(ok => {
  const srv = http.createServer((q, r) => {
    let file = q.url.split('?')[0].split('#')[0]; if (file.endsWith('/')) file += 'index.html';
    const abs = path.join(ROOT, file); if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) { r.statusCode = 404; return r.end(); }
    r.setHeader('Content-Type', TYPES[path.extname(abs)] || 'application/octet-stream');
    // troca o banco e a API de verdade pelos falsos; não achou a linha, o app.js nem sai: teste nenhum fala com produção
    if (file === '/app.js') { const src = fs.readFileSync(abs, 'utf8'), DB = /const DB = (['"])[^'"]*\1;/, API = /const API = '([^']*)';/;
      if (!DB.test(src)) { r.statusCode = 500; return r.end('_serve.cjs: não achei a linha `const DB = ...` no app.js'); }
      if (!API.test(src)) { r.statusCode = 500; return r.end("_serve.cjs: não achei a linha `const API = '...'` no app.js"); }
      return r.end(src.replace(DB, "const DB = 'https://fake-db.firebaseio.com';").replace(API, `const API = '${API_FALSA}';`)); }
    if (file === '/index.html') { const api = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').match(/const API = '([^']*)';/)?.[1];
      const html = fs.readFileSync(abs, 'utf8'); return r.end(api ? html.split(api).join(API_FALSA) : html); }
    r.end(fs.readFileSync(abs));
  }).listen(0, () => ok({ srv, porta: (srv.address()).port }));
});
module.exports.API_FALSA = API_FALSA;
