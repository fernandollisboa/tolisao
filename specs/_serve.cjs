const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
// a API falsa (_api.cjs); a CSP do index.html troca a de verdade por ela, senão o navegador barrava
const API_FALSA = 'https://fake-api.tolisa.test';
// com { banco, api } (o npm run dev), os falsos moram no próprio servidor, em /__banco e /__api:
// mesma origem, a CSP deixa sem mexer nela. Sem eles (os testes), o playwright intercepta os endereços falsos
module.exports = ({ banco = null, api = null, porta = 0 } = {}) => new Promise(ok => {
  const DB_FALSO = banco ? '/__banco' : 'https://fake-db.firebaseio.com', API_APP = api ? '/__api' : API_FALSA;
  const falso = async (q, r, f, caminho) => {
    let texto = ''; for await (const c of q) texto += c;
    const res = await f(q.method, caminho, q.headers, texto);
    r.writeHead(res.status, { ...(res.corpo === undefined ? {} : { 'Content-Type': 'application/json' }), ...res.cabecalhos });
    r.end(res.corpo === undefined ? undefined : JSON.stringify(res.corpo));
  };
  const srv = http.createServer((q, r) => {
    const url = q.url.split('?')[0].split('#')[0];
    if (banco && url.startsWith('/__banco/')) return falso(q, r, (m, c, h, t) => banco.responde(m, c, h, t), url.slice(8));
    if (api && url.startsWith('/__api/')) return falso(q, r, (m, c, h, t) => api.responde(m, c, t), url.slice(6));
    let file = url; if (file.endsWith('/')) file += 'index.html';
    const abs = path.join(ROOT, file); if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) { r.statusCode = 404; return r.end(); }
    r.setHeader('Content-Type', TYPES[path.extname(abs)] || 'application/octet-stream');
    // troca o banco e a API de verdade pelos falsos; não achou a linha, o app.js nem sai: teste nenhum fala com produção
    if (file === '/app.js') { const src = fs.readFileSync(abs, 'utf8'), DB = /const DB = (['"])[^'"]*\1;/, API = /const API = '([^']*)';/;
      if (!DB.test(src)) { r.statusCode = 500; return r.end('_serve.cjs: não achei a linha `const DB = ...` no app.js'); }
      if (!API.test(src)) { r.statusCode = 500; return r.end("_serve.cjs: não achei a linha `const API = '...'` no app.js"); }
      return r.end(src.replace(DB, `const DB = '${DB_FALSO}';`).replace(API, `const API = '${API_APP}';`)); }
    if (file === '/index.html') { const real = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').match(/const API = '([^']*)';/)?.[1];
      const html = fs.readFileSync(abs, 'utf8'); return r.end(real ? html.split(real).join(API_FALSA) : html); }
    r.end(fs.readFileSync(abs));
  }).listen(porta, () => ok({ srv, porta: (srv.address()).port }));
});
module.exports.API_FALSA = API_FALSA;
