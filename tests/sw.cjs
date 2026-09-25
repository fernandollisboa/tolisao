// Testa a ordem do fetch handler do sw.js, isolado num vm.Context — sem depender de
// browser de verdade. Bug real (issue #13): o r.clone() só saía dentro do .then()
// assíncrono do caches.open(), depois que o navegador já podia ter começado a ler o
// corpo ("Response body is already used"). Reproduzir isso num browser de teste é
// racy (só aparece quando caches.open() demora mais que o navegador pra consumir o
// corpo, o que numa rede local e rápida quase nunca acontece — tentei via Playwright
// e o bug não repetia). Em vez de correr atrás de um timing de browser, este teste
// simula exatamente essa corrida: caches.open() só resolve depois de um macrotask
// (como a IPC de verdade do navegador), e o "consumo do corpo" é marcado assim que a
// promise do respondWith() resolve (um microtask, como o navegador faz na prática).
// clone() tem que sempre vir ANTES do consumo, não importa o quanto caches.open() demore.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

/** roda o handler de 'fetch' do sw.js com um Request/Response fake e devolve a ordem dos eventos */
function rodaFetchHandler({ mode = 'no-cors', ok = true, atrasoCacheOpenMs = 5 } = {}) {
  const ordem = [];
  let handlerFetch;
  const sandbox = {
    self: { addEventListener: (nome, fn) => { if (nome === 'fetch') handlerFetch = fn; } },
    caches: {
      open: () => new Promise(resolve => setTimeout(() => resolve({ put: (chave, resp) => { ordem.push('cache.put'); return Promise.resolve(); } }), atrasoCacheOpenMs)),
      match: () => Promise.resolve(undefined),
    },
    fetch: () => Promise.resolve({
      ok,
      clone() { ordem.push('clone'); return { ok, _clone: true }; },
    }),
    Request: class { constructor(url, opts) { this.url = url; Object.assign(this, opts || {}); } },
    URL,
    location: { origin: 'http://localhost' },
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  if (!handlerFetch) throw new Error('sw.js não registrou nenhum listener de fetch');

  let promessaRespondWith;
  handlerFetch({
    request: { url: 'http://localhost/app.js?v=1', method: 'GET', mode },
    respondWith: p => { promessaRespondWith = p; },
  });
  if (!promessaRespondWith) throw new Error('fetch handler não chamou respondWith()');
  return promessaRespondWith.then(() => {
    ordem.push('consumo'); // o navegador lendo o corpo, exatamente quando devolvemos a resposta
    return new Promise(resolve => setTimeout(() => resolve(ordem), atrasoCacheOpenMs + 20));
  });
}

(async () => {
  const exige = (ok, msg) => { if (!ok) throw new Error('sw: ' + msg); };

  for (const mode of ['no-cors', 'navigate']) {
    const ordem = await rodaFetchHandler({ mode, atrasoCacheOpenMs: 15 });
    const iClone = ordem.indexOf('clone'), iConsumo = ordem.indexOf('consumo');
    exige(iClone !== -1, `(${mode}) nunca clonou a resposta pra guardar no cache`);
    exige(iClone < iConsumo, `(${mode}) clonou depois do corpo já consumido: ${JSON.stringify(ordem)}`);
    console.log(`${mode}: clone antes do consumo — ${JSON.stringify(ordem)}`);
  }

  // resposta com erro (r.ok === false): não deve nem tentar clonar/guardar no cache
  const semCache = await rodaFetchHandler({ ok: false });
  exige(!semCache.includes('clone') && !semCache.includes('cache.put'), 'guardou no cache uma resposta que não era ok');
  console.log('resposta não-ok: não tenta guardar no cache — ok');

  console.log('sw: ok');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
