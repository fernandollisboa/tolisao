// rede primeiro, cache como reserva: atualizações chegam na hora e o app abre offline com a última versão vista
const CACHE = 'tolisa-v5';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// o ?v= vira o SHA a cada deploy: guardada a versão nova de um arquivo, as outras dele saem,
// senão o cache juntava uma cópia do app.js e do style.css por deploy, pra sempre
const guarda = (c, chave, copia) => c.put(chave, copia).then(() => {
  const url = new URL(chave.url);
  if (!url.searchParams.has('v')) return;
  return c.keys().then(ks => Promise.all(ks.filter(k => k.url !== chave.url && new URL(k.url).pathname === url.pathname).map(k => c.delete(k))));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const nav = e.request.mode === 'navigate';
  // o HTML sempre revalida: é ele que carrega a versão (?v=) do css e do js.
  // sem isso, o cache de 10 min do Pages segura o HTML velho e o app abre com assets antigos
  const pedido = nav ? new Request(e.request.url, { cache: 'no-cache' }) : e.request;
  // a navegação leva o ?evento= do evento: guarda pela URL sem query, senão cada
  // evento visitado virava uma cópia igual do mesmo index.html no cache
  const chave = nav ? new Request(url.origin + url.pathname) : e.request;
  // o clone tem que sair antes de devolver r: se esperar o caches.open() abrir pra
  // clonar, o navegador já começou a ler o corpo e o clone falha ("body is already used")
  e.respondWith(fetch(pedido).then(r => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => guarda(c, chave, copia)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (nav ? caches.match('./index.html') : undefined))));
});

// ---------- aviso no celular (push) ----------
// o push vem vazio (a API não carrega valor nenhum): o aviso se escreve aqui, relendo no banco cada
// evento com aviso ligado. A página guardou (sala, me, code, db) no IndexedDB quando a pessoa ligou.
// O texto é o mesmo do toast do avisaPagos, no app.js
const JANELA_MS = 10 * 60 * 1000; // a mesma da API: pagamento mais velho que isso já não avisa
const avisos = (modo, f) => new Promise((ok, erro) => {
  const pedido = indexedDB.open('tolisa', 1);
  pedido.onupgradeneeded = () => pedido.result.createObjectStore('avisos', { keyPath: 'sala' });
  pedido.onerror = () => erro(pedido.error);
  pedido.onsuccess = () => { const db = pedido.result, t = db.transaction('avisos', modo), r = f(t.objectStore('avisos'));
    t.oncomplete = () => { db.close(); ok(r && r.result); }; t.onerror = () => { db.close(); erro(t.error); }; };
});
const lista = x => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : []).filter(v => v && typeof v === 'object');
const reais = c => { const [i, d] = (Math.abs(c) / 100).toFixed(2).split('.'); return 'R$ ' + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
const juntos = ns => ns.length > 1 ? ns.slice(0, -1).join(', ') + ' e ' + ns[ns.length - 1] : ns[0];
/** o que caiu pra mim num evento desde o último aviso: { texto, code } ou null */
async function novidade(a, contas) {
  if (!/^[0-9a-f]{64}$/.test(a.sala) || !/^[a-z0-9]{1,32}$/.test(a.me) || !/^https:\/\/[a-z0-9-]+\.firebaseio\.com$/.test(a.db)) return null;
  const r = await fetch(`${a.db}/rooms/${a.sala}.json`, { cache: 'no-store' });
  if (!r.ok) return null;
  const sala = await r.json(), gente = lista(sala && sala.people), agora = Date.now();
  if (a.sala in contas) contas[a.sala] = pendentes(sala, a.me);
  const nome = id => String((gente.find(p => p.id === id) || {}).name || '?').slice(0, 30), eu = nome(a.me);
  const vistos = new Set(Array.isArray(a.vistos) ? a.vistos : []);
  const novos = lista(sala && sala.expenses).filter(e => e.kind === 'payment' && typeof e.id === 'string' && !vistos.has(e.id)
    && typeof e.at === 'number' && agora - e.at < JANELA_MS && e.by !== eu && typeof e.amount === 'number');
  if (!novos.length) return null;
  await avisos('readwrite', s => s.put({ ...a, vistos: [...vistos, ...novos.map(e => e.id)].slice(-50) }));
  const recebe = e => (Array.isArray(e.among) ? e.among : Object.values(e.among || {}))[0];
  const soma = es => reais(es.reduce((s, e) => s + Math.round(e.amount * 100), 0));
  const evento = typeof sala.name === 'string' && sala.name ? ' · ' + sala.name.slice(0, 40) : '';
  const pra = novos.filter(e => !e.forgiven && recebe(e) === a.me && e.payer !== a.me);
  if (pra.length) {
    const quem = [...new Set(pra.map(e => nome(e.payer)))];
    return { code: a.code, texto: `💸 ${juntos(quem)} ${quem.length > 1 ? 'te pagaram' : 'te pagou'} ${soma(pra)}${evento}` };
  }
  // o perdão avisa quem devia
  const perdoes = novos.filter(e => e.forgiven === true && e.payer === a.me);
  if (perdoes.length) {
    const quem = [...new Set(perdoes.map(e => nome(recebe(e))))];
    return { code: a.code, texto: `🙏 ${juntos(quem)} ${quem.length > 1 ? 'perdoaram' : 'perdoou'} teus ${soma(perdoes)}${evento}` };
  }
  return null;
}
// a bolinha no ícone: a página guarda quantas linhas do acerto são minhas em cada evento ({ sala: 'bolinha', n });
// o push refaz a conta do evento que ele releu e soma tudo de novo. Só o número, nunca valor
const okId = id => typeof id === 'string' && /^[a-z0-9]{1,32}$/.test(id);
const membros = e => Array.isArray(e.among) ? e.among : Object.values(e.among || {});
/** a mesma conta do app.js (balances + settlements): quantas linhas do acerto têm `me` */
function pendentes(sala, me) {
  const b = new Map(lista(sala && sala.people).filter(p => okId(p.id)).map(p => [p.id, 0]));
  const fora = new Set(Array.isArray(sala && sala.deleted) ? sala.deleted : []);
  for (const e of lista(sala && sala.expenses)) {
    const among = membros(e), ids = among.filter(id => b.has(id)), c = Math.round(+e.amount * 100);
    if (fora.has(e.id) || !Number.isFinite(c) || !ids.length || !b.has(e.payer)) continue;
    const partes = e.shares && typeof e.shares === 'object' ? among.map(id => Math.max(0, Math.round(+e.shares[id] || 0))) : null;
    const certas = partes && partes.reduce((s, x) => s + x, 0) === c;
    b.set(e.payer, b.get(e.payer) + c);
    const base = Math.floor(c / ids.length), resto = c - base * ids.length;
    ids.forEach((id, i) => b.set(id, b.get(id) - (certas ? partes[among.indexOf(id)] : base + (i < resto ? 1 : 0))));
  }
  const d = [], cr = [];
  for (const [id, v] of b) if (v < 0) d.push({ id, c: -v }); else if (v > 0) cr.push({ id, c: v });
  d.sort((x, y) => y.c - x.c); cr.sort((x, y) => y.c - x.c);
  let n = 0, i = 0, j = 0;
  while (i < d.length && j < cr.length) {
    const v = Math.min(d[i].c, cr[j].c);
    if (d[i].id === me || cr[j].id === me) n++;
    d[i].c -= v; cr[j].c -= v;
    if (!d[i].c) i++;
    if (!cr[j].c) j++;
  }
  return n;
}
self.addEventListener('push', e => e.waitUntil((async () => {
  let aviso = null;
  try {
    const todos = await avisos('readonly', s => s.getAll()), bol = todos.find(a => a.sala === 'bolinha'), contas = { ...(bol && bol.n) };
    for (const a of todos) if ((aviso = await novidade(a, contas).catch(() => null))) break;
    if (bol && 'setAppBadge' in self.navigator) {
      await avisos('readwrite', s => s.put({ sala: 'bolinha', n: contas }));
      const total = Object.values(contas).reduce((s, x) => s + (+x || 0), 0);
      await (total ? self.navigator.setAppBadge(total) : self.navigator.clearAppBadge());
    }
  } catch {}
  // o navegador exige uma notificação por push: sem achar o pagamento, vai a genérica
  const { texto = 'alguém marcou que te pagou no tô lisa', code = '' } = aviso || {};
  await self.registration.showNotification('tô lisa', { body: texto, icon: 'ficha-192.png', tag: 'pago:' + code, data: { code } });
})()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const code = (e.notification.data && e.notification.data.code) || '';
  const url = new URL(code ? '?evento=' + encodeURIComponent(code) : './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const aberta = cs.find(c => c.url === url);
    return aberta ? aberta.focus() : self.clients.openWindow(url);
  }));
});
