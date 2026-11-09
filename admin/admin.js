// @ts-check
// o painel do dono (tolisa.com.br/admin): a chave vai pra API (POST /admin), que devolve o resumo das visitas, um token
// de uma hora da conta de serviço só de leitura e os códigos guardados com a digital. A busca baixa o rooms.json do
// Firebase com esse token, aqui no navegador. Tudo que vem do banco entra por textContent: o banco é hostil.
(() => {
  const API = 'https://tolisa-api.fernando-costa-fd0.workers.dev'; // o mesmo const API do app.js
  const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (document.querySelector(s));
  /** @param {string} tag @param {string} [cls] @param {string|number|null} [txt] */
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = String(txt);
    return e;
  };
  const norm = (/** @type {any} */ t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const sha = async (/** @type {string} */ s) =>
    [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  /** @type {{ chave: string, banco: string, token: string, codigos: string[] } | null} */
  let sessao = null;

  // ---------- entrar ----------
  $('#entraForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = /** @type {HTMLButtonElement} */ ($('#entraBtn')),
      erro = $('#entraErr');
    btn.disabled = true;
    erro.textContent = '';
    try {
      const chave = /** @type {HTMLInputElement} */ ($('#chave')).value;
      const r = await fetch(`${API}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || `a API respondeu ${r.status}`);
      sessao = { chave, banco: d.banco, token: d.token, codigos: Array.isArray(d.codigos) ? d.codigos : [] };
      visitas(d.resumo);
      $('#entra').classList.add('hidden');
      $('#painel').classList.remove('hidden');
      $('#buscaQ').focus();
    } catch (e) {
      erro.textContent = /** @type {Error} */ (e).message || 'não consegui falar com a API';
    } finally {
      btn.disabled = false;
    }
  };

  // ---------- as visitas ----------
  const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const fmt = (/** @type {string} */ d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const semana = (/** @type {string} */ d) => SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()];
  /** @param {string} l @param {string|number} v */
  const linha = (l, v) => {
    const r = el('div', 'row');
    r.append(el('span', '', l), el('span', 'd'), el('span', '', v));
    return r;
  };
  /** os dias já na lista, do mais novo pro mais velho: os 15 da API e os que o "ver mais" trouxe
   * @type {{ dia: string, n: number }[]} */
  let dias = [];
  /** @param {any} r o resumo da API (os últimos 15 dias) */
  function visitas(r) {
    const box = $('#visitas');
    box.textContent = '';
    const ant = r.semanaAntes,
      p = ant ? Math.round(((r.semana - ant) / ant) * 100) : 0;
    box.append(
      el('h2', '', '*** últimos 7 dias ***'),
      el('div', 'big', r.semana),
      el(
        'div',
        'c muted',
        ant
          ? `${p > 0 ? '+' : ''}${p}% contra a semana anterior (${ant})`
          : r.semana
            ? 'primeira semana com visita'
            : 'nada nas duas semanas',
      ),
      el('div', 'hr'),
      linha('hoje', r.hoje),
      linha('ontem', r.ontem),
      linha('últimos 15 dias', r.quinzena),
    );
    if (r.melhor) box.append(linha(`melhor dia (${fmt(r.melhor.dia)})`, r.melhor.n));
    const mais = /** @type {HTMLButtonElement} */ (el('button', 'mais', '▾ ver mais 15 dias'));
    box.append(el('div', 'hr'), el('h2', '', '*** dia a dia ***'), el('div', 'dias'), mais);
    mais.onclick = verMais;
    dias = r.ultimos.slice();
    desenhaDias();
    box.append(
      el('div', 'hr'),
      el(
        'div',
        'c muted nota',
        'aparelhos por dia: quem limpa o navegador conta de novo, e quem abre com ?naoconta não conta.',
      ),
    );
  }
  /** a lista inteira de novo: a barra é proporcional ao maior dia do que já está na lista */
  function desenhaDias() {
    const lista = $('#visitas .dias'),
      maior = Math.max(1, ...dias.map((u) => u.n));
    lista.textContent = '';
    for (const u of dias) {
      const s = semana(u.dia),
        d = el('div', `dia${u.n ? '' : ' zero'}${s === 'sáb' || s === 'dom' ? ' fds' : ''}`),
        b = el('span', 'b');
      b.style.width = `${Math.round((u.n / maior) * 100)}%`;
      d.append(el('span', '', fmt(u.dia)), el('span', '', s), b, el('span', 'n', u.n));
      lista.append(d);
    }
  }
  /** o dia (AAAA-MM-DD) `n` dias antes de `dia`, no calendário */
  const antes = (/** @type {string} */ dia, /** @type {number} */ n) =>
    new Date(Date.parse(`${dia}T12:00:00Z`) - n * 864e5).toISOString().slice(0, 10);
  /** mais 15 dias pra trás, direto do banco com o token: só a janela desce (o lixo de fora, como dia do ano 2000, não).
   * Uma janela inteira vazia é o começo da contagem: o botão some */
  async function verMais() {
    if (!sessao) return;
    const btn = /** @type {HTMLButtonElement} */ ($('#visitas .mais')),
      ate = antes(dias[dias.length - 1].dia, 1),
      de = antes(ate, 14);
    btn.disabled = true;
    btn.textContent = 'carregando…';
    try {
      const q = (/** @type {string} */ v) => encodeURIComponent(`"${v}"`);
      const r = await fetch(
        `${sessao.banco}/visitas.json?orderBy=${encodeURIComponent('"$key"')}&startAt=${q(de)}&endAt=${q(ate)}&access_token=${encodeURIComponent(sessao.token)}`,
      );
      if (r.status === 401 || r.status === 403)
        throw new Error('o acesso venceu (dura uma hora): recarregue e entre de novo');
      if (!r.ok) throw new Error(`o banco respondeu ${r.status}`);
      const cru = (await r.json()) || {},
        novos = Array.from({ length: 15 }, (_, i) => {
          const dia = antes(ate, i),
            n = cru[dia];
          return { dia, n: Number.isInteger(n) && n > 0 ? n : 0 };
        });
      dias = dias.concat(novos);
      desenhaDias();
      if (novos.every((u) => !u.n)) {
        btn.replaceWith(
          el(
            'p',
            'c muted nota',
            `nada de ${fmt(novos[14].dia)} a ${fmt(novos[0].dia)}: a contagem começou depois disso`,
          ),
        );
        return;
      }
      btn.textContent = '▾ ver mais 15 dias';
    } catch (e) {
      btn.textContent = `${/** @type {Error} */ (e).message} · tentar de novo`;
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- a busca ----------
  /** @type {Record<string, any> | null} */ let salas = null;
  /** @type {Map<string, string>} */ const porHash = new Map();
  async function baixa() {
    if (salas || !sessao) return;
    $('#buscaSt').textContent = 'baixando os eventos…';
    const r = await fetch(`${sessao.banco}/rooms.json?access_token=${encodeURIComponent(sessao.token)}`);
    if (r.status === 401 || r.status === 403)
      throw new Error('o acesso venceu (dura uma hora): recarregue e entre de novo');
    if (!r.ok) throw new Error(`o banco respondeu ${r.status}`);
    salas = (await r.json()) || {};
    for (const c of sessao.codigos) porHash.set(await sha(c), c);
  }
  /** o código, quando dá pra saber: guardado com a digital, ou o próprio nome (os eventos do começo)
   * @param {string} id @param {any} s */
  async function codigoDe(id, s) {
    const guardado = porHash.get(id);
    if (guardado) return guardado;
    const n = typeof s.name === 'string' ? s.name.trim().toLowerCase() : '';
    for (const c of new Set([n, n.replace(/\s+/g, '-'), norm(n), norm(n).replace(/\s+/g, '-')]))
      if (c && (await sha(c)) === id) return c;
    return null;
  }
  $('#busca').onsubmit = async (ev) => {
    ev.preventDefault();
    const out = $('#buscaRes'),
      st = $('#buscaSt');
    out.textContent = '';
    const t = norm(/** @type {HTMLInputElement} */ ($('#buscaQ')).value);
    if (!t) return;
    try {
      await baixa();
    } catch (e) {
      st.textContent = /** @type {Error} */ (e).message;
      return;
    }
    const todas = /** @type {Record<string, any>} */ (salas),
      achou = [];
    for (const [id, s] of Object.entries(todas)) {
      if (!s || typeof s !== 'object') continue;
      const gente = Array.isArray(s.people)
        ? s.people
            .filter((/** @type {any} */ p) => p && typeof p.name === 'string')
            .map((/** @type {any} */ p) => p.name)
        : [];
      if (norm(s.name || '').includes(t) || gente.some((/** @type {string} */ g) => norm(g).includes(t)))
        achou.push({ id, s, gente });
    }
    achou.sort((a, b) => (+b.s.updatedAt || 0) - (+a.s.updatedAt || 0));
    const total = Object.keys(todas).length;
    st.textContent = achou.length ? `${achou.length} de ${total} eventos` : `nada entre ${total} eventos`;
    for (const { id, s, gente } of achou.slice(0, 50)) {
      const c = await codigoDe(id, s),
        n = Array.isArray(s.expenses) ? s.expenses.length : 0,
        card = el('div', 'ev'),
        topo = el('div', 'row');
      topo.append(
        el('span', '', typeof s.name === 'string' && s.name ? s.name : '(sem nome)'),
        el('span', 'd'),
        el('span', '', s.updatedAt ? new Date(+s.updatedAt).toLocaleDateString('pt-BR') : ''),
      );
      card.append(topo, el('div', 'muted', `${gente.join(', ') || 'ninguém'} · ${n} lançamento${n === 1 ? '' : 's'}`));
      if (c) {
        const a = /** @type {HTMLAnchorElement} */ (el('a', '', `abrir (${c})`));
        a.href = `https://tolisa.com.br/?evento=${encodeURIComponent(c)}`;
        a.target = '_blank';
        a.rel = 'noopener';
        const l = el('div');
        l.append(a);
        card.append(l);
      } else {
        // o id e quando começou: com eles dá pra procurar o final sorteado do código (specs/acha-codigo.cjs)
        const ats = [...(Array.isArray(s.people) ? s.people : []), ...(Array.isArray(s.expenses) ? s.expenses : [])]
          .map((x) => +(x && x.at))
          .filter((x) => x > 0);
        const desde = ats.length ? ` · começou em ${new Date(Math.min(...ats)).toLocaleDateString('pt-BR')}` : '';
        card.append(el('div', 'muted', `sem o código${desde}`), el('div', 'muted id', id));
      }
      out.append(card);
    }
    if (achou.length > 50) out.append(el('p', 'c muted', 'mostrando os 50 mais recentes'));
  };

  // ---------- testar o aviso ----------
  // o push vai de verdade (API → serviço de push → sw.js), pra este aparelho: a inscrição é a que o app fez quando o 🔔
  // foi ligado (o sw.js é do site inteiro, o admin também enxerga). Antes do pedido, a hora do toque vai pro banco do
  // sw.js ({ sala: 'teste', em }): quando o push chega, ele diz no aviso quanto demorou e conta pra esta página
  /** o mesmo banco do avisos() do sw.js e do avisosDb() do app.js
   * @param {IDBTransactionMode} modo @param {(s: IDBObjectStore) => any} f */
  const avisos = (modo, f) =>
    new Promise((ok, erro) => {
      const pedido = indexedDB.open('tolisa', 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore('avisos', { keyPath: 'sala' });
      pedido.onerror = () => erro(pedido.error);
      pedido.onsuccess = () => {
        const db = pedido.result,
          t = db.transaction('avisos', modo);
        f(t.objectStore('avisos'));
        t.oncomplete = () => (db.close(), ok(undefined));
        t.onerror = () => (db.close(), erro(t.error));
      };
    });
  let esperando = 0;
  /** @type {ReturnType<typeof setTimeout> | undefined} */ let desiste;
  if ('serviceWorker' in navigator)
    navigator.serviceWorker.onmessage = (ev) => {
      if (!esperando || !ev.data || typeof ev.data.teste !== 'number') return;
      esperando = 0;
      clearTimeout(desiste);
      const st = $('#testaSt');
      st.textContent = '';
      st.append(el('b', '', `chegou em ${(ev.data.teste / 1000).toFixed(1).replace('.', ',')} s`));
      if (typeof ev.data.texto === 'string') st.append(el('div', 'nota', ev.data.texto.split('\n')[0]));
    };
  $('#testaBtn').onclick = async () => {
    if (!sessao) return;
    const btn = /** @type {HTMLButtonElement} */ ($('#testaBtn')),
      st = $('#testaSt'),
      res = $('#testaRes');
    res.textContent = '';
    esperando = 0;
    clearTimeout(desiste);
    btn.disabled = true;
    st.textContent = 'mandando…';
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window))
        throw new Error('este navegador não tem aviso no celular');
      const reg = await navigator.serviceWorker.getRegistration('/'),
        sub = reg && (await reg.pushManager.getSubscription());
      if (!sub)
        throw new Error(
          'este aparelho não tem o aviso ligado: abra um evento no tô lisa, ligue o 🔔 e volte aqui (no iPhone, pelo app instalado)',
        );
      await avisos('readwrite', (s) => s.put({ sala: 'teste', em: Date.now() }));
      const r = await fetch(`${API}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: sessao.chave, teste: { endpoint: sub.endpoint } }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || `a API respondeu ${r.status}`);
      // o Worker velho não conhece o teste e devolve o painel de novo
      if (typeof d.push !== 'number') throw new Error('a API ainda não sabe testar: espere o deploy do servidor');
      if (d.push >= 200 && d.push < 300) {
        st.textContent = `o serviço de push aceitou (${d.push}). esperando chegar…`;
        esperando = Date.now();
        desiste = setTimeout(() => {
          if (!esperando) return;
          esperando = 0;
          st.textContent =
            'não chegou em 1 minuto. o celular pode estar segurando (economia de bateria, não perturbe), ou as notificações do site estão bloqueadas.';
        }, 60_000);
      } else
        st.textContent =
          d.push === 404 || d.push === 410
            ? 'o serviço de push disse que a inscrição deste aparelho morreu: desligue e ligue o 🔔 de novo'
            : `o serviço de push respondeu ${d.push || 'nada'}: o aviso não saiu`;
      const eventos = Array.isArray(d.eventos) ? d.eventos : [];
      if (!d.inscricoes)
        res.append(
          el(
            'p',
            'c muted nota',
            'a API não tem este aparelho em evento nenhum: o cron das 19h não tem pra onde mandar. ligue o 🔔 de novo num evento.',
          ),
        );
      for (const e of eventos) {
        const card = el('div', 'ev');
        card.append(linha(String(e.evento), String(e.pessoa)), el('div', 'muted', `às 19h: ${e.cron}`));
        res.append(card);
      }
      if (d.inscricoes > eventos.length)
        res.append(el('p', 'c muted nota', `mostrando ${eventos.length} de ${d.inscricoes} eventos`));
      if (d.salas)
        res.append(
          el(
            'p',
            'c muted nota',
            `o cron lê até ${d.porDia} eventos por dia, sorteados, e hoje ${d.salas === 1 ? 'há 1' : `há ${d.salas}`} com aviso ligado${
              d.salas > d.porDia ? `: cada um é lido em uns ${Math.round((d.porDia / d.salas) * 100)}% dos dias` : ''
            }.`,
          ),
        );
    } catch (e) {
      st.textContent = /** @type {Error} */ (e).message || 'não consegui falar com a API';
    } finally {
      btn.disabled = false;
    }
  };
})();
