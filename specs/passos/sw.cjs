const fs = require('fs'), path = require('path'), vm = require('vm');
const { When, Then, expect } = require('./_mundo.cjs');

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');

// cache falso: um Map de URL pra resposta, com o mesmo put/keys/delete/match do de verdade
function cacheFalso(ordem, guardado = new Map()) {
  return {
    guardado,
    put: (k, r) => { ordem.push('guarda'); guardado.set(k.url, r); return Promise.resolve(); },
    keys: () => Promise.resolve([...guardado.keys()].map(url => ({ url }))),
    delete: k => Promise.resolve(guardado.delete(k.url)),
  };
}

function busca({ mode = 'no-cors', ok = true, atrasoCache = 15, url = 'http://localhost/app.js?v=1', guardado, offline = false } = {}) {
  const ordem = []; let aoBuscar; const cache = cacheFalso(ordem, guardado);
  const semQuery = u => u.split('?')[0];
  const sandbox = {
    self: { addEventListener: (nome, fn) => { if (nome === 'fetch') aoBuscar = fn; } },
    caches: {
      open: () => new Promise(r => setTimeout(() => r(cache), atrasoCache)),
      match: (req, op) => Promise.resolve([...cache.guardado].find(([k]) => op && op.ignoreSearch ? semQuery(k) === semQuery(req.url) : k === req.url)?.[1]),
    },
    fetch: () => offline ? Promise.reject(new TypeError('offline')) : Promise.resolve({ ok, versao: url, clone() { ordem.push('copia'); return { ok, versao: url }; } }),
    Request: class { constructor(url, op) { this.url = url; Object.assign(this, op || {}); } },
    URL, location: { origin: 'http://localhost' },
  };
  vm.createContext(sandbox); vm.runInContext(src, sandbox);
  let resposta; aoBuscar({ request: { url, method: 'GET', mode }, respondWith: p => { resposta = p; } });
  return resposta.then(r => { ordem.push('lê'); return new Promise(ok => setTimeout(() => ok({ ordem, resposta: r, cache: cache.guardado }), atrasoCache + 20)); });
}

When('o service worker busca um arquivo e o cache demora pra abrir', async ({ mundo }) => { mundo.nota.sw = await busca(); });
When('o service worker busca a página e o cache demora pra abrir', async ({ mundo }) => { mundo.nota.sw = await busca({ mode: 'navigate' }); });
When('o service worker busca um arquivo que responde com erro', async ({ mundo }) => { mundo.nota.sw = await busca({ ok: false }); });
Then('ele copia a resposta antes de o navegador ler', async ({ mundo }) => {
  const o = mundo.nota.sw.ordem; expect(o).toContain('copia'); expect(o.indexOf('copia')).toBeLessThan(o.indexOf('lê'));
});
Then('guarda a cópia no cache', async ({ mundo }) => { expect(mundo.nota.sw.ordem).toContain('guarda'); });
Then('ele não copia nem guarda nada', async ({ mundo }) => { expect(mundo.nota.sw.ordem).toEqual(['lê']); });

// o cache como quem usa muito deixa: o app.js e o style.css de um deploy antigo e a página
When('o service worker guarda a versão nova de um arquivo que já tinha cópia', async ({ mundo }) => {
  const guardado = new Map([['http://localhost/app.js?v=velho', { versao: 'velho' }], ['http://localhost/style.css?v=velho', { versao: 'velho' }], ['http://localhost/', { versao: 'página' }]]);
  mundo.nota.sw = await busca({ url: 'http://localhost/app.js?v=novo', guardado });
});
Then('o cache só tem a versão nova desse arquivo', async ({ mundo }) => {
  expect([...mundo.nota.sw.cache.keys()].filter(k => k.includes('/app.js'))).toEqual(['http://localhost/app.js?v=novo']);
});
Then('os outros arquivos continuam no cache', async ({ mundo }) => {
  expect([...mundo.nota.sw.cache.keys()]).toEqual(expect.arrayContaining(['http://localhost/style.css?v=velho', 'http://localhost/']));
});
Then('sem rede, o arquivo abre com a versão nova', async ({ mundo }) => {
  const r = await busca({ url: 'http://localhost/app.js?v=novo', guardado: mundo.nota.sw.cache, offline: true });
  expect(r.resposta && r.resposta.versao).toBe('http://localhost/app.js?v=novo');
});
