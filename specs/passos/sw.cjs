const fs = require('fs'), path = require('path'), vm = require('vm');
const { When, Then, expect } = require('./_mundo.cjs');

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');

function busca({ mode = 'no-cors', ok = true, atrasoCache = 15 } = {}) {
  const ordem = []; let aoBuscar;
  const sandbox = {
    self: { addEventListener: (nome, fn) => { if (nome === 'fetch') aoBuscar = fn; } },
    caches: {
      open: () => new Promise(r => setTimeout(() => r({ put: () => { ordem.push('guarda'); return Promise.resolve(); } }), atrasoCache)),
      match: () => Promise.resolve(undefined),
    },
    fetch: () => Promise.resolve({ ok, clone() { ordem.push('copia'); return { ok }; } }),
    Request: class { constructor(url, op) { this.url = url; Object.assign(this, op || {}); } },
    URL, location: { origin: 'http://localhost' },
  };
  vm.createContext(sandbox); vm.runInContext(src, sandbox);
  let resposta; aoBuscar({ request: { url: 'http://localhost/app.js?v=1', method: 'GET', mode }, respondWith: p => { resposta = p; } });
  return resposta.then(() => { ordem.push('lê'); return new Promise(r => setTimeout(() => r(ordem), atrasoCache + 20)); });
}

When('o service worker busca um arquivo e o cache demora pra abrir', async ({ mundo }) => { mundo.nota.ordem = await busca(); });
When('o service worker busca a página e o cache demora pra abrir', async ({ mundo }) => { mundo.nota.ordem = await busca({ mode: 'navigate' }); });
When('o service worker busca um arquivo que responde com erro', async ({ mundo }) => { mundo.nota.ordem = await busca({ ok: false }); });
Then('ele copia a resposta antes de o navegador ler', async ({ mundo }) => {
  const o = mundo.nota.ordem; expect(o).toContain('copia'); expect(o.indexOf('copia')).toBeLessThan(o.indexOf('lê'));
});
Then('guarda a cópia no cache', async ({ mundo }) => { expect(mundo.nota.ordem).toContain('guarda'); });
Then('ele não copia nem guarda nada', async ({ mundo }) => { expect(mundo.nota.ordem).toEqual(['lê']); });
