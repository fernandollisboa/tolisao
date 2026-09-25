// rede primeiro, cache como reserva: atualizações chegam na hora e o app abre offline com a última versão vista
const CACHE = 'tolisa-v4';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const nav = e.request.mode === 'navigate';
  // o HTML sempre revalida: é ele que carrega a versão (?v=) do css e do js.
  // sem isso, o cache de 10 min do Pages segura o HTML velho e o app abre com assets antigos
  const pedido = nav ? new Request(e.request.url, { cache: 'no-cache' }) : e.request;
  // a navegação leva o ?senha= do evento: guarda pela URL sem query, senão cada
  // evento visitado virava uma cópia igual do mesmo index.html no cache
  const chave = nav ? new Request(url.origin + url.pathname) : e.request;
  e.respondWith(fetch(pedido).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(chave, r.clone())); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (nav ? caches.match('./index.html') : undefined))));
});
