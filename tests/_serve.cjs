const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
/** Porta 0 (o padrão) é o SO escolhendo uma livre: `await srv.pronto` diz qual foi.
 *  Porta cravada já colidiu na prática — dois testes rodando, EADDRINUSE. */
module.exports = (porta = 0) => {
  const s = http.createServer((q, r) => {
    let file = q.url.split('?')[0].split('#')[0]; if (file === '/') file = '/index.html';
    const abs = path.join(ROOT, file); if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) { r.statusCode = 404; return r.end(); }
    r.setHeader('Content-Type', TYPES[path.extname(abs)] || 'application/octet-stream');
    if (file === '/app.js') return r.end(fs.readFileSync(abs, 'utf8').replace(/const DB = '[^']*';/, "const DB = 'https://fake-db.firebaseio.com';"));
    r.end(fs.readFileSync(abs));
  }).listen(porta);
  /** @type {Promise<number>} */
  const pronto = new Promise((ok, erro) => { s.once('error', erro);
    s.once('listening', () => ok(/** @type {import('net').AddressInfo} */ (s.address()).port)); });
  return Object.assign(s, { pronto });
};
