// @ts-check
/** @typedef {{ id: string, name: string, at: number }} Person */
/** @typedef {{ id: string, desc: string, amount: number, payer: string, among: string[], at: number, kind?: 'payment', forgiven?: true, by?: string, byId?: string, shares?: Record<string, number> }} Expense */
/** @typedef {{ id: string, desc: string, amount: number, at: number, by: string, byId?: string, goneAt: number, to?: string, lostTo?: string }} Gone */
/** @typedef {{ v: 2, name: string, updatedAt: number, people: Person[], expenses: Expense[], deleted: string[], gone: Gone[] }} Room */
/** @typedef {{ from: string, to: string, cents: number }} Transfer */
(() => {
  // o app inteiro mora neste arquivo. As seções, na ordem (cada uma abre com um
  // "// ---------- nome ----------" e mora num "// #region nome", que o editor dobra):
  //   config → o que fica no aparelho (localStorage) → o estado da página
  //   → a conta: limpar e mesclar (clean, merge) → o banco (sync) → dinheiro
  //   → a conta: saldos e quem paga quem (balances, settlements) → cores
  //   → fila das animações → desenhos (ícones) → pix → aviso no celular → a nota (render) → o anotar
  //   → cartões (overlays) → entrar num evento → meus eventos → a digital → botões → cliques
  //   → imagem da comanda → instalar → a ficha do rodapé → código de barras → QR → início
  // tudo começa na última seção, "início": lê o ?evento= do endereço e abre o evento.

  // #region config
  // ---------- config ----------
  const DB = 'https://racha-77bc7-default-rtdb.firebaseio.com';
  const API = 'https://tolisa-api.fernando-costa-fd0.workers.dev'; // o worker do aviso no celular (servidor/)
  const POLL_MS = 6000;
  const REDE_MS = 8000; // prazo de cada ida ao banco: rede engasgada no bar vira "Offline" em vez de prender o sync
  const DESFAZER = true; // três toques no carimbo PAGO desfazem o pagamento, útil pra testar
  // O Chrome não mostra mais banner de instalar sozinho: ele só avisa a página pelo
  // beforeinstallprompt e espera o site pedir. Pede o #instalar do topo, e o toque do ✎.
  const INSTALAR = true;
  const PEGA_FICHA = false; // pegar a ficha com o mouse: no desktop o gesto não fecha, então só no toque
  const APERTO_VISITAS = 3; // o aperto dos itens só nas primeiras visitas, e nunca depois de abrir a lista
  const CONTA_VISITAS = true; // soma 1 em visitas/<dia> no banco, uma vez por aparelho por dia; o dono lê no console
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname); // rodando na máquina: não conta visita
  const RECEBI = false; // "recebi" na linha de quem me deve (pagaram por fora): desligado por enquanto
  const JA_ANOTADO_H = 12; // gasto com o mesmo valor e o mesmo pagante, anotado há menos que isso: o anotar pergunta se não é o mesmo
  const PERDOA_ATE = 1000; // em centavos: dívida abaixo disso ganha o "perdoar" na linha de quem recebe
  const PAGOS_NA_LISTA = 3; // quitações que ficam à vista no Falta pagar; o resto, e o que já zerou, some pra não poluir
  const PARADO_DIAS = 7; // evento sem mudança há tantos dias, e me devem: ganha selo na lista e o zap cobra com outro tom
  const QUITADO_DIAS = 15; // evento quite e sem mudança há tantos dias desce pros "quitados antigos", recolhidos no fim da lista
  const ESQUECIDO_DIAS = 30; // daí em diante a cobrança é da diva (no modo chato, fica no tom de parado)
  const AVISO_PUSH = true; // quem recebe liga o aviso no celular, e todo pagamento marcado cutuca a API
  // guardar e entrar com a digital (passkey, #168), protótipo: desligado pra todo mundo. O dono liga só no
  // aparelho dele abrindo o site com ?digital (fica lembrado; ?digital=0 desliga)
  const DIGITAL = false;
  const CURRENCY = 'R$';

  /** @returns {any} */
  const $ = (s) => document.querySelector(s);
  /** @returns {HTMLInputElement[]} */
  const inputs = (s) => /** @type {HTMLInputElement[]} */ ([...document.querySelectorAll(s)]);
  /** n letras de [a-z0-9] tiradas do crypto: o que protege (tok do pix, final do código) não pode vir do Math.random */
  const sorteia = (n) =>
    [...crypto.getRandomValues(new Uint8Array(n))].map((b) => '0123456789abcdefghijklmnopqrstuvwxyz'[b % 36]).join('');
  const uid = () => sorteia(8);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const sha = async (s) =>
    [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const semCartao = () => document.querySelector('#overlay').classList.contains('hidden');
  // #endregion
  // #region o que fica no aparelho (localStorage)
  // ---------- o que fica no aparelho (localStorage) ----------
  /** localStorage que não quebra: em aba anônima ou com o armazenamento cheio ele lança erro */
  const ls = {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
        return true;
      } catch {
        return false;
      }
    },
    del: (k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    },
  };
  // o que fica no aparelho, em duas gavetas de JSON:
  //   tolisa         { visits, countedDay, installPrompted, itemsOpened, boringMode, myName, pixKey, passkeyOn, passkeyId,
  //                  phones: {nome: '55…' ou '' de pulado} }
  //                  (myName: o último nome que escolhi; pixKey: a minha última chave pix, nunca o tok;
  //                  passkeyOn: a digital ligada neste aparelho pelo ?digital; passkeyId: a passkey que guardou a lista;
  //                  phones: o zap de quem eu cobro, pelo nome, só neste aparelho)
  //   tolisa:<sala>  { code, openedAt, changedAt, hidden, me, lastSeen, pixTokens: {pessoa: tok}, lightsSeen: [pessoa], paysSeen: [id], snapshot,
  //                  pushTok, pushOn }  (pushTok: o segredo dos avisos desse evento, como o tok do pix; pushOn: quem ligou o aviso)
  // quem lê sempre pega o que está no localStorage na hora, então outra aba não perde o que gravou
  const DEVICE = 'tolisa',
    roomKey = (id) => `${DEVICE}:${id}`;
  /** lê uma gaveta (um JSON no localStorage); estragada ou vazia, vem {} @returns {Record<string, any>} */
  const gaveta = (k) => {
    try {
      const o = JSON.parse(ls.get(k) || '{}');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  };
  /** "apagar meus dados" começou: nada mais grava, senão um sync no meio devolvia a gaveta que acabou de sair */
  let apagando = false;
  /** abre a gaveta, deixa `f` mexer nela e grava de volta @param {string} k @param {(o: Record<string, any>) => void} f */
  const mexe = (k, f) => {
    if (apagando) return false;
    const o = gaveta(k);
    f(o);
    return ls.set(k, JSON.stringify(o));
  };
  const device = () => gaveta(DEVICE),
    setDevice = (campo, v) =>
      mexe(DEVICE, (o) => {
        if (v === undefined) delete o[campo];
        else o[campo] = v;
      });
  // as chaves antigas (racha:visitas, racha:<sala>:pixtok:<pessoa>…) mudam pras gavetas uma vez.
  // O tok do pix não pode se perder: sem ele a pessoa nunca mais troca a chave, então
  // o velho só sai depois que o novo gravou
  (() => {
    let velhas = [];
    try {
      velhas = Object.keys(localStorage).filter((k) => k.startsWith('racha:'));
    } catch {}
    if (!velhas.length) return;
    const dev = gaveta(DEVICE),
      salas = {},
      sala = (id) => (salas[id] ||= gaveta(roomKey(id)));
    for (const k of velhas) {
      const v = ls.get(k) || '',
        [, a, b, c] = k.split(':'),
        json = () => {
          try {
            return JSON.parse(v);
          } catch {
            return undefined;
          }
        };
      if (a === 'visitas') dev.visits = Math.max(+v || 0, dev.visits || 0);
      else if (a === 'convidou') dev.installPrompted = true;
      else if (a === 'abriuItens') dev.itemsOpened = true;
      else if (a === 'chato') dev.boringMode = true;
      else if (a === 'room') dev.lastRoom ??= json();
      else if (/^[0-9a-f]{64}$/.test(a)) {
        if (!b) sala(a).snapshot ??= json();
        else if (b === 'me') sala(a).me ??= v;
        else if (b === 'seen') sala(a).lastSeen ??= +v || 0;
        else if (b === 'pixtok' && c) (sala(a).pixTokens ||= {})[c] ??= v;
      }
    }
    const ok = [[DEVICE, dev], ...Object.entries(salas).map(([id, o]) => [roomKey(id), o])].every(([k, o]) =>
      ls.set(k, JSON.stringify(o)),
    );
    if (ok) velhas.forEach(ls.del);
  })();
  // o último evento aberto morava na gaveta do aparelho; agora cada evento guarda o próprio
  // código, que é o que a lista de eventos precisa pra reabrir. Sem ele o evento não volta
  (() => {
    const r = device().lastRoom;
    if (!r) return;
    if (
      typeof r.code === 'string' &&
      /^[0-9a-f]{64}$/.test(r.id || '') &&
      !mexe(roomKey(r.id), (o) => {
        o.code ??= r.code;
        o.openedAt ??= Date.now();
      })
    )
      return;
    setDevice('lastRoom', undefined);
  })();
  // visitas contadas neste aparelho: o convite de instalar e o aperto dos itens leem daqui
  const visitas = (+device().visits || 0) + 1;
  setDevice('visits', visitas);
  // aparelhos por dia: um +1 no banco, que ninguém lê (só o dono, no console). O dia é o de Brasília (2026-10-06)
  const hojeBR = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  if (CONTA_VISITAS && !LOCAL && DB && device().countedDay !== hojeBR)
    fetch(`${DB}/visitas/${hojeBR}.json?print=silent`, {
      method: 'PUT',
      body: '{".sv":{"increment":1}}',
      keepalive: true,
    })
      .then((r) => r.ok && setDevice('countedDay', hojeBR))
      .catch(() => {});
  // #endregion
  // #region o estado da página
  // ---------- o estado da página ----------
  // tudo que muda enquanto a página está aberta. O resto do arquivo lê e escreve aqui
  /** o id do evento no banco: sha-256 do código @type {string|null} */ let groupId = null;
  /** o código inteiro, com o final sorteado ("churras-k7f3q9") */ let roomName = '';
  /** o evento: gente, gastos e pagamentos @type {Room|null} */ let state = null;
  /** o id da pessoa que está vendo ("Sou Fulano") @type {string|null} */ let me = null;
  /** o &quem= do link compartilhado: quem abre já entra como essa pessoa @type {string|null} */ let quemDoLink = null;
  /** quando esta pessoa viu o evento pela última vez: o que chegou depois ganha "novo" */ let lastSeen = 0;
  /** pessoa → chave pix, lida do banco @type {Record<string, string>} */ let pixKeys = {};
  /** já consultou as chaves pix uma vez (antes disso, nada de botão de pix) */ let pixReady = false;
  /** a lista de itens aberta, e com todos (não só os 10 últimos) */ let itemsOpen = false,
    showAll = false;
  /** os itens apagados, recolhidos no fim da lista, estão abertos */ let showGone = false;
  /** os itens com os detalhes abertos @type {Set<string>} */ const openItems = new Set();
  /** o anotar: 'equal' (igual) ou 'custom' (partes diferentes) */ let splitMode = 'equal';
  /** o gasto que o anotar está editando @type {string|null} */ let editando = null;
  /** modo chato (easter egg da ficha): sem diva, e o rodapé vira "Deus é fiel." */ let chato = !!device().boringMode;
  let pollTimer = null,
    saving = false; // um sync de cada vez
  // a ficha do rodapé; as duas funções são preenchidas em jogaDiva(), lá no fim
  const ficha = {
    /** a ficha vai cair: o Sou Fulano e o ✎ esperam ela pegar a vez na fila */
    vem: () => false,
    /** joga a ficha de novo (trocou de pessoa, ela entrou num botão, a diva voltou a falar) */
    rejoga: () => {},
  };
  /** o nome que aparece: o que a pessoa digitou quando criou (evento antigo: o próprio código) */
  const evento = () => (state && state.name) || roomName;

  /** @returns {Room} */
  const fresh = (name = '') => ({ v: 2, name, updatedAt: Date.now(), people: [], expenses: [], deleted: [], gone: [] });
  const room = () => gaveta(roomKey(groupId)),
    setRoom = (campo, v) =>
      mexe(roomKey(groupId), (o) => {
        o[campo] = v;
      });
  const cacheSave = () => setRoom('snapshot', state);
  const cacheLoad = () => {
    try {
      return clean(room().snapshot);
    } catch {
      return null;
    }
  };

  // #endregion
  // #region a conta: limpar e mesclar (clean, merge)
  // ---------- a conta: limpar e mesclar (união por id; exclusões vencem) ----------
  // dados do banco/cache são de terceiros: só ids [a-z0-9] entram em atributos HTML, tudo o mais vira string curta ou número
  const okId = (id) => typeof id === 'string' && /^[a-z0-9]{1,32}$/.test(id);
  // o limite é em unidade UTF-16 porque é o que o .validate do banco conta (length <= 40,
  // 30, 60): cortar por grafema deixaria 40 emojis com 80 unidades e a escrita seria
  // recusada. Só não pode parar no meio de um par surrogate — meia letra vira � na tela,
  // na comanda e no zap. Aparar a metade órfã nunca deixa a string maior que o orçamento.
  const apara = (t) => (/[\uD800-\uDBFF]$/.test(t) ? t.slice(0, -1) : t);
  const str = (v, n) => (typeof v === 'string' ? apara(v.slice(0, n)) : '');
  // um gasto se divide entre até 100 pessoas: o banco valida o among com índice de até 2 dígitos.
  // Acima disso o gasto inteiro fica de fora, porque cortar gente deixaria a conta sem fechar
  const RACHA_MAX = 100;
  /** @param {any} d @returns {Room|null} */
  function clean(d) {
    if (!d || typeof d !== 'object') return null;
    const people = (Array.isArray(d.people) ? d.people : [])
      .filter((p) => p && okId(p.id) && str(p.name, 30).trim())
      .map((p) => ({ id: p.id, name: str(p.name, 30), at: +p.at || 0 }));
    const expenses = (Array.isArray(d.expenses) ? d.expenses : [])
      .filter(
        (e) =>
          e &&
          okId(e.id) &&
          okId(e.payer) &&
          Array.isArray(e.among) &&
          e.among.length &&
          e.among.length <= RACHA_MAX &&
          e.among.every(okId) &&
          Number.isFinite(+e.amount),
      )
      .map((e) => {
        const o = {
          id: e.id,
          desc: str(e.desc, 60),
          amount: Math.round(+e.amount * 100) / 100,
          payer: e.payer,
          among: e.among.slice(),
          at: +e.at || 0,
        };
        if (e.kind === 'payment') o.kind = 'payment';
        if (o.kind && e.forgiven === true) o.forgiven = true; // pagamento perdoado: conta igual, carimbo PERDOADO
        if (typeof e.by === 'string') o.by = str(e.by, 30);
        if (okId(e.byId)) o.byId = e.byId; // quem anotou, pelo id: o `by` em texto fica pro item antigo
        if (e.shares && typeof e.shares === 'object') {
          o.shares = {};
          for (const id of o.among) o.shares[id] = Math.max(0, Math.round(+e.shares[id] || 0));
          // partes que não fecham o valor viram divisão igual: senão os saldos não somam zero
          if (o.among.reduce((s, id) => s + o.shares[id], 0) !== Math.round(o.amount * 100)) delete o.shares;
        }
        return o;
      });
    // item apagado guarda quem apagou e o que era; `to` é o item que tomou o lugar dele, numa edição;
    // `lostTo` marca a edição que perdeu pra outra feita ao mesmo tempo, e diz qual ganhou
    const gone = (Array.isArray(d.gone) ? d.gone : [])
      .filter((g) => g && okId(g.id) && Number.isFinite(+g.amount))
      .map((g) => {
        const o = {
          id: g.id,
          desc: str(g.desc, 60),
          amount: Math.round(+g.amount * 100) / 100,
          at: +g.at || 0,
          by: str(g.by, 30),
          goneAt: +g.goneAt || 0,
        };
        if (okId(g.byId)) o.byId = g.byId;
        if (okId(g.to)) o.to = g.to;
        if (okId(g.lostTo)) o.lostTo = g.lostTo;
        return o;
      });
    return {
      v: 2,
      name: str(d.name, 40),
      updatedAt: +d.updatedAt || 0,
      people,
      expenses,
      deleted: (Array.isArray(d.deleted) ? d.deleted : []).filter(okId),
      gone,
    };
  }
  // Firebase devolve chaves em ordem alfabética; compara sem depender da ordem
  const canon = (o) =>
    JSON.stringify(o, (k, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((x) => [x, v[x]]),
          )
        : v,
    );
  /** @param {Room|null} a @param {Room|null} b @returns {Room|null} */
  function merge(a, b) {
    a = clean(a);
    b = clean(b);
    if (!a) return b;
    if (!b) return a;
    const deleted = new Set([...(a.deleted || []), ...(b.deleted || [])]);
    const byId = (list) => {
      const m = new Map();
      for (const x of list || []) if (!deleted.has(x.id)) m.set(x.id, x);
      return m;
    };
    // editar troca o item por outro (`to`): dois aparelhos editando o mesmo item deixam dois
    // substitutos. Vale a edição mais nova, e o outro substituto sai também, senão o gasto conta duas vezes.
    // O que saiu fica no `gone` com `lostTo`: quem editou vê que a edição dela não valeu
    const gone = new Map();
    const todos = [...a.expenses, ...b.expenses];
    for (const g of [...a.gone, ...b.gone]) {
      if (!deleted.has(g.id)) continue;
      const o = gone.get(g.id);
      if (!o) gone.set(g.id, g);
      else if (o.to && g.to && o.to !== g.to) {
        const novo = g.goneAt > o.goneAt || (g.goneAt === o.goneAt && g.to > o.to); // empate: os dois aparelhos escolhem igual
        const [ganhou, perdeu] = novo ? [g, o] : [o, g];
        gone.set(g.id, ganhou);
        deleted.add(perdeu.to);
        const e = todos.find((x) => x.id === perdeu.to);
        if (e && !gone.has(e.id))
          gone.set(e.id, {
            id: e.id,
            desc: e.desc,
            amount: e.amount,
            at: e.at,
            by: perdeu.by,
            ...(perdeu.byId ? { byId: perdeu.byId } : {}),
            goneAt: perdeu.goneAt,
            lostTo: ganhou.to,
          });
      }
    }
    // quem está num gasto não sai da turma: o ✕ só olha este aparelho, e outro pode ter
    // acabado de pôr a pessoa num gasto. Tirar ela sumia com a parte dela da conta
    for (const e of [...a.expenses, ...b.expenses])
      if (!deleted.has(e.id)) for (const id of [e.payer, ...e.among]) deleted.delete(id);
    const people = new Map([...byId(a.people), ...byId(b.people)]);
    const expenses = new Map([...byId(a.expenses), ...byId(b.expenses)]);
    return {
      v: 2,
      name: a.name || b.name || '',
      updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
      people: [...people.values()].sort((x, y) => (x.at || 0) - (y.at || 0)),
      expenses: [...expenses.values()].sort((x, y) => x.at - y.at),
      deleted: [...deleted].slice(-500),
      gone: [...gone.values()].sort((x, y) => x.goneAt - y.goneAt).slice(-50),
    };
  }

  // #endregion
  // #region o banco (sync)
  // ---------- o banco (Firebase via REST) ----------
  const setStatus = (msg, err) => {
    const el = $('#status');
    el.textContent = msg;
    el.classList.toggle('err', !!err);
  };
  const roomUrl = (id) => `${DB}/rooms/${id}.json`;
  /** fetch no banco, com prazo: no 3G engasgado a conexão para sem dar erro, e quem espera (o sync, o quita, o anotar)
   *  ficava preso. Estourou, vira erro comum. O prazo vale até o fim da leitura da resposta, por isso o timer não
   *  se desliga. setTimeout e não AbortSignal.timeout(): o relógio falso dos testes adianta ele
   *  @param {string} url @param {RequestInit} [op] */
  const noBanco = (url, op = {}) => {
    const c = new AbortController();
    setTimeout(() => c.abort(new Error('a rede não respondeu')), REDE_MS);
    return fetch(url, { ...op, signal: c.signal });
  };
  // a sala vem com o ETag dela: o sync grava com if-match, e se outro aparelho gravou entre
  // a baixada e a subida o banco responde 412 em vez de passar por cima do que ele gravou
  /** @returns {Promise<{ data: any, etag: string | null }>} */
  async function baixa(id) {
    const r = await noBanco(roomUrl(id), { cache: 'no-store', headers: { 'X-Firebase-ETag': 'true' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data === null) throw Object.assign(new Error('não encontrado'), { notFound: true });
    return { data, etag: r.headers.get('ETag') };
  }
  const apiGet = async (id) => (await baixa(id)).data;
  /** @param {string} id @param {any} data @param {string | null} [etag] */
  async function apiPut(id, data, etag) {
    // passa pelo clean() na ida também: as regras do banco só aceitam a sala nesse formato
    // (nome até 40, pessoa até 30, item até 60…), e um campo a mais recusaria a gravação inteira
    const r = await noBanco(roomUrl(id), {
      method: 'PUT',
      headers: etag ? { 'if-match': etag } : {},
      body: JSON.stringify(clean(data)),
    });
    if (r.status === 412) throw Object.assign(new Error('mudou no meio'), { mudou: true });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  }

  // o merge() deixa o banco ganhar na mesma pessoa: o nome trocado aqui segura até o banco gravar ele
  /** @type {Record<string, string>} */ const renomes = {};
  function renomeia(st, remote) {
    for (const [id, nome] of Object.entries(renomes)) {
      const p = st.people.find((x) => x.id === id);
      if (p) p.name = nome;
      const r = remote && remote.people && remote.people.find((x) => x.id === id);
      if (!p || (r && r.name === nome)) delete renomes[id];
    }
    return st;
  }
  async function sync() {
    // baixa, mescla e sobe se houver novidade
    if (!groupId || saving) return;
    saving = true;
    try {
      // outro aparelho gravou no meio: baixa de novo e mescla por cima do que ele gravou
      for (let vez = 1; ; vez++) {
        const { data: remote, etag } = await baixa(groupId);
        const merged = renomeia(merge(state, remote), remote);
        const changed = canon(merged) !== canon(remote);
        state = merged;
        cacheSave();
        render();
        avisaPagos();
        if (!changed) break;
        try {
          await apiPut(groupId, state, etag);
          break;
        } catch (e) {
          if (!e.mudou || vez === 3) throw e;
        }
      }
      cutucaApi(); // o banco já tem o pagamento: agora a API acha ele lá
      setStatus(
        'Sincronizado ' +
          new Date().toLocaleDateString('pt-BR') +
          ' ' +
          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      );
    } catch (e) {
      if (e.notFound) return showLost();
      setStatus('Offline · ' + e.message, true);
    } finally {
      saving = false;
    }
  }
  function commit() {
    state.updatedAt = Date.now();
    cacheSave();
    render();
    sync();
  }
  let tick = 0;
  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (!document.hidden) {
        sync();
        if (++tick % 5 === 0) loadPixKeys();
      }
    }, POLL_MS);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sync();
  });

  // #endregion
  // #region dinheiro
  // ---------- dinheiro ----------
  // dinheiro é sempre centavo inteiro. O banco guarda `amount` em reais (formato antigo),
  // então quem lê um gasto passa por centavos(e), e só os formatadores abaixo dividem por 100
  /** @param {{ amount: number }} e */
  const centavos = (e) => Math.round(e.amount * 100);
  /** 123456 → "1.234,56" (sem sinal: quem chama diz se deve ou recebe) */
  const reais = (c) => {
    const [i, d] = (Math.abs(c) / 100).toFixed(2).split('.');
    return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d;
  };
  /** 123456 → "R$ 1.234,56" */
  const comSifrao = (c) => `${CURRENCY}\u00a0${reais(c)}`;
  /** o mesmo, em html, com o R$ e o número em spans separados */
  const valorHtml = (c) => `<span class="cur">${CURRENCY}</span><span class="num">${reais(c)}</span>`;
  /** o que a pessoa digitou → centavos (ou NaN). No teclado do celular o separador é
   *  vírgula; aceita 12,50 e 1.234,56 além de 12.50 */
  const lerCentavos = (v) => {
    let s = String(v).trim().replace(/\s/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(s) * 100);
  };
  // #endregion
  // #region a conta: saldos e quem paga quem (balances, settlements)
  // ---------- a conta: saldos e quem paga quem ----------
  const nameOf = (id) => (state.people.find((p) => p.id === id) || { name: '?' }).name;
  const nomeExiste = (n) => state.people.some((p) => p.name.toLowerCase() === n.toLowerCase());
  function shares(cents, ids) {
    const base = Math.floor(cents / ids.length),
      rem = cents - base * ids.length;
    const o = {};
    ids.forEach((id, i) => (o[id] = base + (i < rem ? 1 : 0)));
    return o;
  }
  /** a divisão igual de um gasto novo: o centavo que sobra começa numa pessoa que anda com a posição
   *  do gasto na lista, e não sempre na primeira da turma. Fica gravado no `shares`: o `shares()` lido
   *  na hora continua igual, senão os saldos dos eventos antigos mudavam
   *  @param {number} cents @param {string[]} ids @param {number} pos */
  function sharesGirando(cents, ids, pos) {
    const ini = pos % ids.length;
    const s = shares(
      cents,
      ids.map((_, i) => ids[(ini + i) % ids.length]),
    );
    /** @type {Record<string, number>} */ const o = {};
    for (const x of ids) o[x] = s[x];
    return o;
  }
  /** dividido igual: sem `shares`, ou com o que o `sharesGirando()` grava quando sobra centavo
   *  @param {Expense} e */
  const ehIgual = (e) => {
    if (!e.shares) return true;
    const c = centavos(e),
      n = e.among.length,
      base = Math.floor(c / n);
    if (!n || c % n === 0 || Object.keys(e.shares).length !== n) return false;
    const v = e.among.map((id) => e.shares[id]);
    return v.every((x) => x === base || x === base + 1) && v.reduce((a, b) => a + b, 0) === c;
  };
  const shareOf = (e, ids) => {
    if (e.shares) {
      const o = {};
      for (const id of ids) o[id] = e.shares[id] || 0;
      return o;
    }
    return shares(centavos(e), ids);
  };
  const howText = (e, name = nameOf, html = false) => {
    const loan = !e.among.includes(e.payer);
    if (!ehIgual(e)) return e.among.map((id) => `${name(id)} ${reais(e.shares[id] || 0)}`).join(', ');
    if (loan) return `${e.among.map(name).join(', ')} deve${e.among.length === 1 ? '' : 'm'} tudo`;
    if (!html) return `÷${e.among.length}`;
    return `<a class="link" data-among="${e.id}" title="ver quem">÷${e.among.length}</a><span class="who"> (${e.among.map(name).join(', ')})</span>`;
  };
  /** @returns {Record<string, number>} saldo em centavos por pessoa (positivo = a receber) */
  /** @param {Room} s */
  function balances(s = state) {
    /** @type {Record<string, number>} */ const b = {};
    s.people.forEach((p) => (b[p.id] = 0));
    for (const e of s.expenses) soma(b, e);
    return b;
  }
  /** põe um gasto (ou pagamento) nos saldos @param {Record<string, number>} b @param {Expense} e */
  function soma(b, e) {
    const ids = e.among.filter((id) => id in b);
    if (!ids.length || !(e.payer in b)) return;
    b[e.payer] += centavos(e);
    const sh = shareOf(e, ids);
    for (const id of ids) b[id] -= sh[id];
  }
  /** quantos gastos, do começo, vão até a última vez que todo mundo ficou quite. Ali a
   *  conta zerou: as quitações de antes já foram acertadas e saem do Falta pagar @param {Room} s */
  function zerouEm(s = state) {
    /** @type {Record<string, number>} */ const b = {};
    s.people.forEach((p) => (b[p.id] = 0));
    let n = 0;
    s.expenses.forEach((e, i) => {
      soma(b, e);
      if (Object.values(b).every((v) => v === 0)) n = i + 1;
    });
    return n;
  }
  /** @param {Record<string, number>} b @returns {Transfer[]} */
  function settlements(b) {
    const d = [],
      c = [];
    for (const [id, v] of Object.entries(b)) {
      if (v < 0) d.push({ id, c: -v });
      else if (v > 0) c.push({ id, c: v });
    }
    d.sort((x, y) => y.c - x.c);
    c.sort((x, y) => y.c - x.c);
    const out = [];
    let i = 0,
      j = 0;
    while (i < d.length && j < c.length) {
      const a = Math.min(d[i].c, c[j].c);
      out.push({ from: d[i].id, to: c[j].id, cents: a });
      d[i].c -= a;
      c[j].c -= a;
      if (!d[i].c) i++;
      if (!c[j].c) j++;
    }
    return out;
  }

  // #endregion
  // #region cores
  // ---------- cores ----------
  const PALETTE = [
    '#8a5345',
    '#45838a',
    '#531c8a',
    '#b25993',
    '#001bb2',
    '#2472b2',
    '#b224b2',
    '#4c3b75',
    '#751742',
    '#0050b2',
  ]; // matizes afastados entre si e longe do vermelho/verde (deve/recebe) e do âmbar dos botões
  // marca-texto: os mesmos matizes da PALETTE, bem mais firmes. No recibo em png o papel é
  // mais escuro e o zap ainda comprime: tom claro sumia no fundo (o de Fernando ficava a 10 dele).
  const MARKR = [
    '#eb8d75',
    '#75dfeb',
    '#b075eb',
    '#eb75c2',
    '#7587eb',
    '#75b6eb',
    '#eb75eb',
    '#9875eb',
    '#eb75ab',
    '#75aaeb',
  ];
  /** a posição da pessoa na lista: escolhe a cor dela */
  const indiceDaPessoa = (id) =>
    Math.max(
      0,
      state.people.findIndex((p) => p.id === id),
    );
  // da 11ª pessoa em diante a cor é gerada, pra nunca repetir: o matiz anda pela razão áurea
  // dentro da faixa do ciano ao magenta (longe do vermelho e do verde de deve/recebe e do âmbar),
  // e o claro/escuro alterna de três em três. As 10 primeiras ficam com as cores de sempre.
  /** @param {number} i */
  const matiz = (i) => (182 + (((i - PALETTE.length) * 0.618033988749895) % 1) * 153).toFixed(2);
  /** a cor de quem está na posição i @param {number} i */
  const corDe = (i) => (i < PALETTE.length ? PALETTE[i] : `hsl(${matiz(i)} 55% ${[40, 31, 48][i % 3]}%)`);
  /** o marca-texto de quem está na posição i @param {number} i */
  const forteDe = (i) => (i < MARKR.length ? MARKR[i] : `hsl(${matiz(i)} 80% ${[72, 64, 79][i % 3]}%)`);
  const colorOf = (id) => corDe(indiceDaPessoa(id));
  // o emoji da conta fechada varia, mas não pisca a cada render: sai do evento e do dia
  const FESTA = ['🎉', '🙌', '🙏', '❣️', '🥂', '✨'];
  const festeja = () => FESTA[hash32((groupId || '') + new Date().toDateString()) % FESTA.length];
  const markForte = (id) => forteDe(indiceDaPessoa(id)); // o mesmo tom, firme: recibo em png e a volta da caneta
  /** o nome da pessoa, na cor dela, pronto pra innerHTML */
  const nomeHtml = (id) => `<span class="nm" style="color:${colorOf(id)}">${esc(nameOf(id))}</span>`;
  const nomeHtmlPorNome = (name) => {
    const p = state.people.find((q) => q.name === name);
    return p ? nomeHtml(p.id) : esc(name);
  };
  // quem anotou vale pelo id (`byId`): o nome muda, o id não. Item antigo, ou regravado por um
  // aparelho de antes do id, só tem o nome em texto (`by`), e aí é pelo nome mesmo
  /** quem anotou ainda está na turma pelo id @param {Expense | Gone} x */
  const autorId = (x) => (x.byId && state.people.some((p) => p.id === x.byId) ? x.byId : '');
  /** foi essa pessoa que anotou @param {Expense | Gone} x @param {string | null} id */
  const anotouQuem = (x, id) => !!id && (x.byId ? x.byId === id : x.by === nameOf(id));
  /** o nome de quem anotou, o de hoje @param {Expense | Gone} x */
  const autorNome = (x) => (autorId(x) ? nameOf(x.byId || '') : x.by || '');
  /** o nome de quem anotou na cor da pessoa, pronto pra innerHTML @param {Expense | Gone} x */
  const autorHtml = (x) => (autorId(x) ? nomeHtml(autorId(x)) : nomeHtmlPorNome(x.by || ''));
  // #endregion
  // #region fila das animações
  // ---------- fila das animações ----------
  // nada anima fora da tela, e cada bloco entra na fila atrás do de cima: a nota se
  // preenche de cima pra baixo, na ordem em que a pessoa leria. Tudo que a fila guarda
  // mora em `anim`, e nota nova (outro evento, outra pessoa) começa de um `anim` zerado.
  // As horas são Date.now(): 0 = ainda não pegou a vez, -1 = dispensado
  const novaNota = () => ({
    nota: 0, // fim da fila das seções (Minha conta, itens, Falta pagar e a ficha)
    fila: 0, // fim da fila inteira, com o Sou Fulano e o ✎ depois das seções
    fim: 0, // quando a última animação acaba de fato, pra quem quer a tela parada
    mine: 0,
    itens: 0,
    settle: 0,
    risco: 0,
    sou: 0,
    fab: 0, // a vez de cada bloco
    naTela: { mine: false, itens: false, settle: false },
    riscos: new Map(), // pagamento -> quando o risco dele começa (pode ser no futuro)
    pix: new Map(), // pessoa -> quando o copiar pix dela brota
    cutucas: [], // timers do Sou Fulano e do ✎
    viuItens: false, // a linha dos itens convida com um verbo ("ver os 3 itens") até a pessoa abrir
    tocouOk: false, // tocou num ✔ ou copiar pix: o convite da piscada já foi respondido
    natal: null, // pisca-pisca de natal dessa vez: o sorteio de atraso de cada linha, ou null
    suave: false, // quem já conhece a linha dos itens ganha só um toquinho na setinha
  });
  let anim = novaNota();
  const RISCO_MS = 550,
    RISCO_GAP = 130;
  // a caneta é rápida, mas não escreve dois traços ao mesmo tempo: cada volta começa
  // quando a anterior fecha, dentro da linha e de uma linha pra outra
  const DESENHA_MS = 180,
    DESENHA_GAP = 180,
    VOLTA_GAP = 360;
  const ANOTA_MS = 2200,
    ANOTA_RESPIRO = 2500,
    SOU_MS = 1200;
  const APERTO_MS = 1600,
    APERTO_LEAD = 300; // a linha dos itens vira botão e afunda uma vez
  let seguraRisco = false; // quitação acabou de sair: espera o cartão de 'quitado!' fechar
  /** uma seção pega a vez atrás da anterior. `dur` é o quanto ela segura a fila (a entrada
   *  do próximo), `total` é quanto ela dura de fato. Seção que chega na tela atrasada (o
   *  Falta pagar abaixo da dobra) entra atrás das seções, não atrás do Sou Fulano e do ✎ */
  const agenda = (dur, total = dur) => {
    const t = Math.max(Date.now(), anim.nota);
    anim.nota = t + dur;
    anim.fila = Math.max(anim.fila, anim.nota);
    anim.fim = Math.max(anim.fim, t + total);
    return t;
  };
  /** o ✎ e o Sou Fulano não dividem a tela com ninguém: esperam tudo acabar e um respiro */
  const calmo = (dur, respiro) => {
    const t = Math.max(anim.fila, Math.max(Date.now(), anim.fim) + respiro);
    anim.fila = anim.fim = t + dur;
    return t;
  };
  /** a classe entra na hora marcada, mas só com o botão na tela; fora dela, espera ele voltar */
  const cutuca = (el, cls, t) => {
    if (semMovimento()) return;
    const vai = () => {
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= innerHeight) return false;
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
      return true;
    };
    const olha = () => {
      if (vai()) removeEventListener('scroll', olha);
    };
    anim.cutucas.push(
      setTimeout(
        () => {
          if (!vai()) addEventListener('scroll', olha, { passive: true });
        },
        Math.max(0, t - Date.now()),
      ),
    );
  };
  const hash32 = (txt) => {
    let h = 2166136261;
    for (const ch of txt) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return (h ^ (h >>> 15)) >>> 0;
  };
  const stampStyle = (id) => {
    const h = hash32(id);
    const rot = (h % 15) - 10,
      dy = ((h >>> 8) % 5) - 2;
    // as quitações que já estavam na nota ganham a hora delas em cascata quando o #settle
    // pega a vez na fila. Aqui só entra uma quitação feita agora, e só sem cartão por
    // cima: escondida, a pessoa só veria o resultado
    if (!anim.riscos.has(id) && anim.risco && !seguraRisco && semCartao()) anim.riscos.set(id, Date.now());
    // o #settle é refeito a cada render: o atraso negativo retoma o risco de onde estava
    const t = anim.riscos.get(id),
      dt = t === undefined ? Infinity : Date.now() - t;
    return {
      cls: dt < RISCO_MS ? ' novo' : '',
      css: `--rot:${rot}deg;--dy:${dy}px`,
      rd: dt < RISCO_MS ? `--rd:${-dt}ms` : '',
    };
  };
  /** traço de marca-texto feito à mão: ângulo, altura e pontas tortas, fixos por linha */
  const markStyle = (seed, color) => {
    const h = hash32(seed),
      g = (bit, min, span) => min + (((h >>> bit) & 15) / 15) * span;
    return (
      `--mk:${color};--mka:${g(0, 177.8, 1.2).toFixed(1)}deg;--mkb:${g(4, 181, 1.2).toFixed(1)}deg;` +
      `--mkt:${g(8, 17, 5).toFixed(0)}%;--mke:${g(12, 78, 5).toFixed(0)}%;--mku:${g(16, 22, 5).toFixed(0)}%;--mkf:${g(20, 73, 5).toFixed(0)}%;` +
      `--mkw:${g(24, 95, 5).toFixed(0)}%;--mkv:${g(2, 92, 6).toFixed(0)}%;--mkx:${g(6, 0, 4).toFixed(0)}%;--mky:${g(10, 2, 6).toFixed(0)}%;--mkz:${g(14, -2, 4).toFixed(0)}px`
    );
  };
  // pagamento novo pra quem está vendo vira aviso, uma vez só. A gaveta guarda os ids já
  // vistos (de qualquer pessoa, senão trocar de nome avisava o passado dos outros); na
  // primeira vez vale o lastSeen: avisa só o que caiu depois da última visita
  function avisaPagos() {
    const pays = state.expenses.filter((e) => e.kind === 'payment');
    const r = room();
    const vistos = new Set(
      Array.isArray(r.paysSeen) ? r.paysSeen : pays.filter((e) => !lastSeen || e.at <= lastSeen).map((e) => e.id),
    );
    const novos = pays.filter((e) => !vistos.has(e.id));
    if (!novos.length && Array.isArray(r.paysSeen)) return;
    setRoom('paysSeen', [...vistos, ...novos.map((e) => e.id)].slice(-200));
    const pra = novos.filter((e) => me && !e.forgiven && e.among[0] === me && e.payer !== me && !anotouQuem(e, me));
    // perdão avisa o outro lado: quem devia e ficou quite sem tocar em nada
    const perdoes = novos.filter((e) => me && e.forgiven && e.payer === me && !anotouQuem(e, me));
    if (!pra.length && perdoes.length) {
      const credores = [...new Set(perdoes.map((e) => nameOf(e.among[0])))];
      const soma = comSifrao(perdoes.reduce((s, e) => s + centavos(e), 0));
      toast(`🙏 ${credores.join(' e ')} ${credores.length > 1 ? 'perdoaram' : 'perdoou'} teus ${soma}`, 5000, 'recebe');
    }
    if (!pra.length) return;
    const total = comSifrao(pra.reduce((s, e) => s + centavos(e), 0));
    const quem = [...new Set(pra.map((e) => nameOf(e.payer)))];
    toast(
      quem.length === 1
        ? `💸 ${quem[0]} te pagou ${total}`
        : `💸 ${quem.slice(0, -1).join(', ')} e ${quem.at(-1)} te pagaram ${total}`,
      5000,
      'recebe',
    );
  }
  const markSeen = () => {
    if (groupId) setRoom('lastSeen', Date.now());
  };
  window.addEventListener('pagehide', markSeen);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) markSeen();
  });
  // #endregion
  // #region desenhos (ícones)
  // ---------- desenhos (ícones) ----------
  const KEY_SVG =
    '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12.65 10A6 6 0 0 0 1 12a6 6 0 0 0 11.65 2H18v3h4v-7h-9.35zM7 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>';
  const PIX_SVG =
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M11.917 11.71a2.046 2.046 0 0 1-1.454-.602l-2.1-2.1a.4.4 0 0 0-.551 0l-2.108 2.108a2.044 2.044 0 0 1-1.454.602h-.414l2.66 2.66c.83.83 2.177.83 3.007 0l2.667-2.668h-.253zM4.25 4.282c.55 0 1.066.214 1.454.602l2.108 2.108a.39.39 0 0 0 .552 0l2.1-2.1a2.044 2.044 0 0 1 1.453-.602h.253L9.503 1.623a2.127 2.127 0 0 0-3.007 0l-2.66 2.66h.414zM14.377 6.496l-1.612-1.612a.307.307 0 0 1-.114.023h-.733c-.379 0-.75.154-1.017.422l-2.1 2.1a1.005 1.005 0 0 1-1.425 0L5.268 5.32a1.448 1.448 0 0 0-1.018-.422h-.9a.306.306 0 0 1-.109-.021L1.623 6.496c-.83.83-.83 2.177 0 3.008l1.618 1.618a.305.305 0 0 1 .108-.022h.901c.38 0 .75-.153 1.018-.421L7.375 8.57a1.034 1.034 0 0 1 1.426 0l2.1 2.1c.267.268.638.421 1.017.421h.733c.04 0 .079.01.114.024l1.612-1.612c.83-.83.83-2.178 0-3.008z"/></svg>';
  // o Compartilhar do Safari: quadrado aberto com a seta saindo pra cima
  const SHARE_SVG =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8"/></svg>';
  // o Adicionar à Tela de Início: quadrado arredondado com um mais
  const MAIS_SVG =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
  const LAPIS_SVG =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M16.4 3.9a2 2 0 0 1 2.8 2.8L8.1 17.8l-3.6.9.9-3.6L16.4 3.9Z"/><path d="M16 18h6M19 15v6"/></svg>';
  const WA_SVG =
    '<svg class="wa" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
  // #endregion
  // #region pix
  // ---------- pix ----------
  // o cobrar mexe mais ligeiro que o ✔ paguei, e o recebi/perdoar abre mais ligeiro que o copiar pix
  const COBRA_MS = 550,
    BROTA_MS = 220;
  const PIX_MS = 420,
    PISCA_MS = 900,
    PISCA_GAP = 320; // uma piscada só, uma linha atrás da outra
  // pisca-pisca de natal: o cordão corre defasado linha a linha, em duas ondas (as pares
  // numa frequência, as ímpares na `.b` do CSS, mais ligeira), e o fecho vem pra todas
  // juntas depois de uma pausa que conta da última linha. Cada linha sorteia um tico de atraso
  const FECHO_EM = 3300,
    FECHO_MS = 1500,
    NATAL_JIT = 90,
    FECHO_JIT = 45;
  const PISCA_LEAD = 420; // o quanto a fila reserva além da última piscada começar
  const pixUrl = (pid, child = '', sala = groupId) => `${DB}/pix/${sala}/${pid}${child}.json`;
  /** grava a chave no banco com o tok deste aparelho (chave vazia apaga) @returns {Promise<Response>} */
  const gravaPix = (sala, pid, key, tok) =>
    noBanco(pixUrl(pid, '', sala), { method: 'PUT', body: JSON.stringify({ key, tok }) });
  async function loadPixKeys() {
    /** @type {Record<string, string>} */ const out = {};
    await Promise.all(
      state.people.map(async (p) => {
        // rede engasgou ou o banco falhou: fica a chave que já tinha. Só some quando o banco diz que não tem
        if (pixKeys[p.id]) out[p.id] = pixKeys[p.id];
        try {
          const r = await noBanco(pixUrl(p.id, '/key'), { cache: 'no-store' });
          if (r.ok) {
            const v = await r.json();
            const k = typeof v === 'string' ? validPixKey(v) : null;
            if (k) out[p.id] = k;
            else delete out[p.id];
          }
        } catch {}
      }),
    );
    const changed = JSON.stringify(out) !== JSON.stringify(pixKeys) || !pixReady;
    pixKeys = out;
    pixReady = true;
    if (changed) render();
  }
  function validPixKey(k) {
    k = k.trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return k.toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(k) && /^[\x20-\x7e]+$/.test(k)) return k.toLowerCase();
    return celularPix(k);
  }
  /** celular com DDD vira a chave pix no formato do BCB (+55DDDNÚMERO). CPF não passa: escrito
   *  como CPF, ou 11 dígitos sem o +55 que fecham o dígito de CPF (aí não dá pra saber o que é) */
  function celularPix(k) {
    if (!/^[\d\s()+.-]+$/.test(k) || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(k)) return null;
    const d = k.replace(/\D/g, ''),
      n = d.length === 13 && d.startsWith('55') ? d.slice(2) : d.length === 11 ? d : '';
    if (!/^[1-9]{2}9\d{8}$/.test(n)) return null;
    if (d.length === 11 && !k.startsWith('+') && cpfValido(n)) return null;
    return '+55' + n;
  }
  /** os dois dígitos verificadores do CPF batem */
  function cpfValido(c) {
    if (/^(\d)\1{10}$/.test(c)) return false;
    const dv = (n) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i);
      return ((s * 10) % 11) % 10;
    };
    return dv(9) === +c[9] && dv(10) === +c[10];
  }
  async function savePix() {
    if (!me) return showWho();
    // a chave fica à vista de todo mundo do evento: celular passa (o grupo já tem o número),
    // CPF não. O erro fica no próprio cartão, que não fecha — um toast no pé da tela a pessoa nem via
    const k = await askText(
      'Chave Pix',
      '',
      'celular, e-mail ou chave aleatória',
      pixKeys[me] || minhaChave(),
      'salvar',
      (v) => !!validPixKey(v),
      '✋ CPF não ✋',
    );
    if (k === null) return;
    const key = validPixKey(k);
    if (!key) return;
    await putPix(me, key);
  }
  /** a última chave que cadastrei neste aparelho, se ainda serve: vem escrita no cadastro de um evento novo */
  const minhaChave = () => (typeof device().pixKey === 'string' && validPixKey(device().pixKey)) || '';
  async function putPix(pid, key) {
    let tok = (room().pixTokens || {})[pid];
    if (typeof tok !== 'string' || !tok) {
      const novo = (tok = sorteia(32));
      // sem o tok no aparelho, a chave que subir fica presa pra sempre: aparelho cheio não manda nada
      const gravou = mexe(roomKey(groupId), (o) => {
        (o.pixTokens ||= {})[pid] = novo;
      });
      if (!gravou) return toast('Sem espaço neste aparelho: a chave não salvou');
      // o primeiro tok pede pro navegador não limpar o aparelho sozinho, que leva o tok junto
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    }
    try {
      const r = await gravaPix(groupId, pid, key, tok);
      if (r.status === 401 || r.status === 403)
        return toast('Essa chave foi cadastrada em outro aparelho: só ele troca');
      if (!r.ok) return toast('A chave não salvou, tenta de novo');
      // a minha chave fica lembrada no aparelho, pra oferecer no próximo evento (só a chave: o tok é de cada evento)
      if (pid === me) {
        if (key) setDevice('pixKey', key);
        else if (device().pixKey === pixKeys[pid]) setDevice('pixKey', undefined);
      }
      // apagar grava a chave vazia: o nó fica, e a regra deixa qualquer aparelho cadastrar de novo
      if (key) pixKeys[pid] = key;
      else delete pixKeys[pid];
      render();
      toast(key ? 'Chave Pix salva' : 'Chave Pix apagada');
    } catch (e) {
      toast('A chave não salvou, tenta de novo');
    }
  }
  // Pix copia e cola (BR Code EMV) com valor
  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
  function pixCode(key, name, cents) {
    const recebedor =
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9 ]/g, '')
        .trim()
        .toUpperCase()
        .slice(0, 25) || 'RECEBEDOR';
    const p =
      tlv('00', '01') +
      tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key)) +
      tlv('52', '0000') +
      tlv('53', '986') +
      tlv('54', (cents / 100).toFixed(2)) +
      tlv('58', 'BR') +
      tlv('59', recebedor) +
      tlv('60', 'BRASIL') +
      tlv('62', tlv('05', '***')) +
      '6304';
    return p + crc16(p);
  }
  // valor digitado como no app do banco: os dígitos entram pela direita, pelos centavos
  // (5 → 0,05, 50 → 0,50, 5000 → 50,00), que é o costume de quem usa app de banco.
  // Refaz o campo inteiro a cada tecla, então apagar tira o último dígito
  const mascara = (el) => {
    const d = el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
    el.value = d ? reais(+d) : '';
  };
  // na captura, antes de quem lê o campo (o quanto falta das partes)
  document.addEventListener(
    'input',
    (ev) => {
      const t = /** @type {HTMLInputElement} */ (ev.target);
      if (t.matches && t.matches('#amount, #sharesBox input[data-share], #quitaValor')) mascara(t);
    },
    true,
  );
  // frases de boteco: sorteadas uma vez por abertura, escolhidas pelo estado da conta
  const SIGNOFF = {
    owe: [
      'Paga logo, meu bem.',
      'Fiado só amanhã, meu amor.',
      'Não aceito cheque, viu?',
      'A conta não se paga sozinha, meu anjo.',
      'Bebeu, pagou, minha flor.',
    ],
    owed: [
      'Cobra sem dó, meu bem.',
      'Quem deve, deve, meu anjo.',
      'Juros só na amizade, viu?',
      'Fiado é confiança, meu amor.',
    ],
    even: [
      'Tudo certo, volte sempre, meu bem!',
      'Casa limpa, meu amor.',
      'Valeu, meu bem!',
      'Deus te pague, minha flor.',
    ],
    all: [
      'Casa fechada, todo mundo quite. Benção!',
      'Ninguém deve nada. Milagre!',
      'Zerou. Bora abrir outra, meu bem?',
    ],
    none: ['Valeu, meu bem!', 'Volte sempre, minha flor!', 'Um beijo, benção.', 'Aberto até o último pagar, viu?'],
  };
  // #endregion
  // #region aviso no celular
  // ---------- aviso no celular (push) ----------
  // quem recebe liga o aviso, e daí todo pagamento marcado cutuca a API (servidor/), que relê
  // o evento no banco e manda um push vazio pro celular de quem recebeu. O sw.js acorda, lê
  // no próprio banco o que mudou e escreve o aviso. A página nunca espera a API: falhou, falhou
  /** pagamentos marcados aqui que a API ainda não soube @type {Set<string>} */ const aAvisar = new Set();
  /** chamado depois que o sync gravou: o banco já tem o pagamento, a API acha ele lá */
  function cutucaApi() {
    for (const id of aAvisar) {
      aAvisar.delete(id);
      if (!state.expenses.some((e) => e.id === id)) continue; // desfeito antes de subir
      fetch(API + '/avisa', { method: 'POST', keepalive: true, body: JSON.stringify({ sala: groupId, id }) }).catch(
        () => {},
      );
    }
  }
  /** no iPhone o push só existe com o app na tela de início: no Safari o 🔔 ensina a instalar */
  const iPhoneSemApp = () => INSTALAR && ehIOS() && !jaInstalado() && !iOSSemPush();
  /** antes do 16.4 o iPhone não tem push nem instalado: o 🔔 não teria o que ensinar */
  const iOSSemPush = () => {
    const v = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    return !!v && (+v[1] < 16 || (+v[1] === 16 && +v[2] < 4));
  };
  /** o navegador sabe receber push, ou é um iPhone que vai saber depois de instalar */
  const temAviso = () =>
    AVISO_PUSH &&
    (iPhoneSemApp() ||
      ('Notification' in window &&
        'PushManager' in window &&
        'serviceWorker' in navigator &&
        (!ehIOS() || jaInstalado())));
  const avisoLigado = () =>
    !!me && room().pushOn === me && 'Notification' in window && Notification.permission === 'granted';
  /** a gaveta do sw.js: (sala, quem, código) de cada evento com aviso ligado, que o push lê sem a página aberta,
   * e a bolinha do ícone ({ sala: 'bolinha', n, eu }) */
  const avisosDb = (modo, f) =>
    new Promise((ok, erro) => {
      const pedido = indexedDB.open('tolisa', 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore('avisos', { keyPath: 'sala' });
      pedido.onerror = () => erro(pedido.error);
      pedido.onsuccess = () => {
        const db = pedido.result,
          t = db.transaction('avisos', modo),
          r = f(t.objectStore('avisos'));
        t.oncomplete = () => {
          db.close();
          ok(r && r.result);
        };
        t.onerror = () => {
          db.close();
          erro(t.error);
        };
      };
    });
  /** a chave VAPID vem em base64url; o subscribe quer os bytes */
  const bytesDe = (b) =>
    Uint8Array.from(atob(b.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b.length % 4)) % 4)), (c) =>
      c.charCodeAt(0),
    );
  /** o segredo dos avisos desse evento: quem ligou primeiro manda, como o tok do pix */
  const pushTok = () => {
    let tok = room().pushTok;
    if (typeof tok !== 'string' || !/^[a-z0-9]{16,64}$/.test(tok)) {
      const novo = (tok = sorteia(32));
      setRoom('pushTok', novo);
    }
    return tok;
  };
  /** a API com o mesmo prazo do banco: sem ele o "Apagando…" ficava preso na rede engasgada */
  const postaApi = (rota, corpo) => {
    const c = new AbortController();
    setTimeout(() => c.abort(new Error('a rede não respondeu')), REDE_MS);
    return fetch(API + rota, { method: 'POST', body: JSON.stringify(corpo), signal: c.signal });
  };
  let mexendoAviso = false;
  /** o 🔔 de Minha conta: pede permissão e inscreve (ligado, o botão some) */
  async function tocaAviso() {
    if (!me || !groupId || mexendoAviso) return;
    if (avisoLigado()) return;
    if (iPhoneSemApp())
      // o app da Tela de Início não enxerga o que o Safari guardou: abre sem evento, daí o código
      return ensinaInstalar(
        `No iPhone o aviso só chega com o tô lisa na Tela de Início. Instala, abre lá o evento <b>${esc(roomName)}</b> e toca no 🔔.`,
      );
    const quem = me,
      sala = groupId;
    mexendoAviso = true;
    try {
      // no Android dá pra receber sem instalar, mas instalado o aviso abre o app: aproveita o toque e convida, uma vez só
      if (convite && !device().installPrompted && !jaInstalado()) {
        await pedeInstalar().catch(() => false);
        // demorou no convite, o toque venceu: sem ele o navegador esconde o pedido de permissão
        if (navigator.userActivation && !navigator.userActivation.isActive)
          return toast('Agora toca no 🔔 de novo pra ligar o aviso');
      }
      if ((await Notification.requestPermission()) !== 'granted')
        return toast('Sem permissão: libera os avisos do site nas configurações do navegador');
      await navigator.serviceWorker.register('sw.js');
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const r = await fetch(API + '/chave');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const { chave } = await r.json();
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDe(chave) });
      }
      const tok = pushTok(),
        antes = room().pushOn;
      await avisosDb('readwrite', (s) => s.put({ sala, me: quem, code: roomName, db: DB }));
      const r = await postaApi('/inscreve', { sala, pessoa: quem, sub: sub.toJSON(), tok });
      if (r.status === 403) return toast('Os avisos de ' + nameOf(quem) + ' foram ligados em outro aparelho');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // trocou de pessoa neste aparelho: o aviso da anterior sai, senão ela continuava chegando aqui
      if (typeof antes === 'string' && antes !== quem)
        postaApi('/desinscreve', { sala, pessoa: antes, endpoint: sub.endpoint, tok }).catch(() => {});
      setRoom('pushOn', quem);
      render();
      toast('Pronto: quando te pagarem, chega aviso 🔔');
    } catch {
      toast('Não deu pra ligar o aviso agora');
    } finally {
      mexendoAviso = false;
    }
  }

  // #endregion
  // #region a nota (render)
  // ---------- a nota (render) ----------
  const luck = Math.random();
  const pick = (list) => list[Math.floor(luck * list.length)];
  // easter egg: segurar, tocar, segurar na ficha desliga a diva (modo chato). Some a
  // ficha, some o subtítulo e o rodapé vira "Deus é fiel.". O mesmo toque no rodapé
  // liga de novo. Fica guardado no aparelho.
  document.body.classList.toggle('chato', chato);
  /** forte (segurou) e fraco (tocou) em sequência; três seguidos formam a senha */
  function senha(alvo, ok) {
    let ritmo = [],
      ini = 0,
      x0 = 0,
      y0 = 0,
      longe = false,
      zera = 0;
    // segurar é o gesto de selecionar texto no iPhone: enquanto o dedo está na ficha (ou
    // no rodapé), a página inteira fica sem seleção, senão o toque longo pintava o papel
    const solta = () => document.body.classList.remove('segurando');
    alvo.addEventListener('pointerdown', (e) => {
      ini = e.timeStamp;
      x0 = e.clientX;
      y0 = e.clientY;
      longe = false;
      clearTimeout(zera);
      document.body.classList.add('segurando');
    });
    alvo.addEventListener('pointercancel', solta);
    addEventListener('pointerup', solta);
    alvo.addEventListener('pointermove', (e) => {
      if (ini && Math.hypot(e.clientX - x0, e.clientY - y0) > 14) longe = true;
    });
    alvo.addEventListener('pointerup', (e) => {
      if (!ini) return;
      const dur = e.timeStamp - ini;
      ini = 0;
      if (longe) {
        ritmo = [];
        return;
      }
      ritmo = [...ritmo, dur >= 450 ? 'F' : 'f'].slice(-3);
      if (ritmo.join('') === 'FfF') {
        ritmo = [];
        ok();
      }
      zera = setTimeout(() => {
        ritmo = [];
      }, 1600);
    });
  }
  /** o subtítulo do cabeçalho muda com o saldo de quem está vendo */
  function subtitulo(hasMe, bal) {
    if (!hasMe || bal > 0) return 'quem me deve?';
    if (bal < 0) return 'pra quem eu devo?';
    return 'mas não devo a ninguém';
  }
  /** a lista de frases do rodapé que combina com a situação */
  function frasesDoRodape(hasMe, bal, allEven) {
    if (allEven) return SIGNOFF.all;
    if (!hasMe) return SIGNOFF.none;
    if (bal < 0) return SIGNOFF.owe;
    if (bal > 0) return SIGNOFF.owed;
    return SIGNOFF.even;
  }
  const temMe = () => !!me && state.people.some((p) => p.id === me);
  /** quem eu sou nos meus outros eventos (lido ao abrir este): a turma trazida leva os mesmos ids @type {Set<string>} */
  let meusIds = new Set();
  /** quem não disse quem é ganha um palpite de um toque: a pessoa que eu já sou em outro evento
   *  (mesmo id) ou, sem ela, a do último nome que escolhi. Só palpite: dois ids batendo, nada */
  function palpite() {
    if (temMe()) return null;
    const porId = state.people.filter((p) => meusIds.has(p.id));
    if (porId.length) return porId.length === 1 ? porId[0] : null;
    const nome = device().myName;
    return (
      (typeof nome === 'string' && nome && state.people.find((p) => p.name.toLowerCase() === nome.toLowerCase())) ||
      null
    );
  }
  /** chegou depois da última visita e foi outra pessoa que anotou */
  const tagNovo = (e) => (lastSeen > 0 && e.at > lastSeen && !anotouQuem(e, me) ? '<span class="tag">novo</span>' : '');
  /** foi editado depois da última visita, e por outra pessoa @param {Gone | undefined} g */
  const tagMudou = (g) =>
    g && lastSeen > 0 && g.goneAt > lastSeen && !anotouQuem(g, me) ? '<span class="tag">mudou</span>' : '';
  /** uma linha da nota: texto à esquerda, pontinhos, valor à direita (`vat` são atributos a mais no valor) */
  const linha = (l, v, cls = '', extra = '', style = '', vat = '') =>
    `<div class="row ${cls}"${style ? ` style="${style}"` : ''}><span class="l">${l}</span><span class="d"></span><span class="v"${vat}>${v}</span>${extra}</div>`;

  /** redesenha a nota inteira a partir do `state`. Roda a cada mudança e a cada sync.
   *  Os agenda…() no meio põem as animações na fila, na ordem em que a página se lê.
   *  A ORDEM DAS CHAMADAS IMPORTA: cada agenda…() pega a vez atrás do anterior, e o
   *  agendaSouEFab() mede na tela as seções que as chamadas de cima acabaram de mostrar.
   *  Trocar a ordem não dá erro nenhum, só bagunça a fila das animações */
  function render() {
    if (!state) return;
    const hasMe = temMe();
    const vazio = state.expenses.length === 0; // sem nada anotado, Minha conta e Itens só teriam zeros: somem
    const saldo = balances(),
      acerto = settlements(saldo),
      bal = hasMe ? saldo[me] || 0 : 0;
    const allEven = state.people.length > 0 && !vazio && Object.values(saldo).every((v) => v === 0);
    const pays = state.expenses
      .slice(zerouEm())
      .filter((e) => e.kind === 'payment')
      .slice(-PAGOS_NA_LISTA)
      .reverse();
    const nMeus = acerto.filter((t) => t.from === me).length;

    renderCabecalho(hasMe, bal, allEven);
    renderChegada(hasMe);
    if (hasMe && !vazio) renderMinha(bal, acerto);
    else $('#mine').classList.add('hidden');
    mostraSecoes(hasMe, bal, vazio, allEven);
    agendaConviteItens(hasMe);
    renderLinhaPix(hasMe, bal);
    renderForm();
    agendaFaltaPagar(pays, nMeus);
    agendaSouEFab(hasMe);
    renderAcerto(hasMe, acerto, pays, nMeus);
    renderItens();
    atualizaBolinha();
  }
  /** o nome do evento, o "Sou Fulano", o subtítulo e a frase do rodapé */
  function renderCabecalho(hasMe, bal, allEven) {
    $('#roomLabel').textContent = evento() || '—';
    document.title = evento() ? `${evento()} · tô lisa` : 'tô lisa · quem me deve?';
    $('#roomLabel').onclick = () => showGate();
    // só reescreve quando muda: refazer o nó a cada sync reiniciava o balancinho do botão
    const wl = $('#whoLine'),
      sug = hasMe ? null : palpite();
    const html = hasMe
      ? `Sou <a class="link" id="whoBtn" style="color:${colorOf(me)}">${esc(nameOf(me))}</a>`
      : sug
        ? `<a class="link amb" id="whoSugere" data-quem="${sug.id}">você é ${esc(sug.name)}?</a> <a class="link" id="whoBtn">não</a>`
        : `<a class="link amb" id="whoBtn">Quem é você?</a>`;
    if (wl.dataset.k !== html) {
      wl.innerHTML = html;
      wl.dataset.k = html;
    }
    // evento sem ninguém começa pela lista de gente; com gente, é só dizer qual você é
    $('#whoBtn').onclick = () => (state.people.length ? showWho() : showSetup());
    if ($('#whoSugere')) $('#whoSugere').onclick = () => souEu($('#whoSugere').dataset.quem);
    if ($('#tagline')) $('#tagline').textContent = subtitulo(hasMe, bal);
    if ($('#signoff')) $('#signoff').textContent = chato ? 'Deus é fiel.' : pick(frasesDoRodape(hasMe, bal, allEven));
  }
  /** um botão por pessoa, numa cápsula com contorno e pontinho na cor dela, com o id em data-<attr>
   *  @param {Person[]} gente @param {string} attr */
  function linkpras(gente, attr) {
    return `<div class="linkpras">${gente.map((p) => `<button class="linkpra" data-${attr}="${p.id}" style="--cor:${colorOf(p.id)}"><i></i>${esc(p.name)}</button>`).join('')}</div>`;
  }
  /** quem chega pelo link do grupo ainda não é ninguém: no topo da nota, um nome por pessoa,
   *  na cor dela, e o "não tô aqui" pra quem falta na lista. É convite, não cartão: ninguém é
   *  interrompido na chegada, e some quando a pessoa diz quem é */
  function renderChegada(hasMe) {
    const el = $('#chegada'),
      quer = !hasMe && state.people.length > 0;
    const html = quer
      ? `<h2>*** Quem é você? ***</h2>
      ${linkpras(state.people, 'chegou')}
      <div class="c"><a class="link" id="chegouFora">não tô aqui</a></div><div class="hr"></div>`
      : '';
    el.classList.toggle('hidden', !quer);
    if (el.dataset.k === html) return;
    el.innerHTML = html;
    el.dataset.k = html;
    for (const b of inputs('#chegada [data-chegou]'))
      b.onclick = () => {
        souEu(b.dataset.chegou);
        const m = $('#mine');
        if (!m.classList.contains('hidden')) m.scrollIntoView({ behavior: semMovimento() ? 'auto' : 'smooth' });
      };
    if (quer) $('#chegouFora').onclick = showSetup;
  }
  /** o que aparece e o que some: o ✎, o zap, a ficha, o Falta pagar e os itens */
  function mostraSecoes(hasMe, bal, vazio, allEven) {
    $('#fab').classList.toggle('hidden', !hasMe); // anotar é de quem já disse quem é
    $('#fab').classList.add('chamando'); // o ✎ fica âmbar o tempo todo
    $('#waBtn').classList.toggle('so', !hasMe); // sozinho o zap encosta na esquerda
    $('#waBtn').classList.toggle('hidden', vazio); // nota vazia não tem o que mandar
    // a ficha só entra em nota que já tem gasto. A cor é a situação: deve (vermelho),
    // recebe (verde), quite (rosa); sem nome, âmbar
    const f = $('.stain');
    if (f) {
      f.classList.toggle('hidden', vazio);
      f.classList.toggle('deve', hasMe && bal < 0);
      f.classList.toggle('recebe', hasMe && bal > 0);
      f.classList.toggle('quite', hasMe && bal === 0);
    }
    // todo mundo quite já é dito em Minha conta; repetir no Falta pagar era eco
    $('#settleHead').classList.toggle('hidden', vazio || allEven);
    $('#settle').classList.toggle('hidden', allEven);
    $('#settleHr').classList.toggle('hidden', allEven);
    $('#itemsSec').classList.toggle('hidden', vazio); // quem está quite também quer ver no que gastou
  }
  /** o convite da linha dos itens pega a vez entre Minha conta e o Falta pagar, como na
   *  página. Com cartão aberto ele espera: os itens aparecem por trás e o convite furava a
   *  fila. Lista já aberta dispensa o convite; quem já abriu antes, ou já veio mais de
   *  APERTO_VISITAS vezes, ganha só um toquinho na setinha */
  function agendaConviteItens(hasMe) {
    if (!anim.itens && itemsOpen) anim.itens = -1;
    if (anim.naTela.itens && !anim.itens && hasMe && semCartao() && !$('#itemsSec').classList.contains('hidden')) {
      anim.suave = !!device().itemsOpened || visitas > APERTO_VISITAS;
      anim.itens = agenda(APERTO_LEAD, APERTO_MS);
    }
  }
  /** o "cadastrar chave pix", pra quem recebe e ainda não tem chave. Ele desce de debaixo
   *  do título; a altura vem um quadro depois do conteúdo, senão a transição não tem de onde sair */
  function renderLinhaPix(hasMe, bal) {
    const quer = hasMe && bal > 0 && !pixKeys[me] && pixReady;
    const html = quer ? `<button class="ico amb" id="pixBtn">${PIX_SVG}${KEY_SVG} cadastrar chave pix</button>` : '';
    const pl = $('#pixLine');
    if (!html) {
      if (pl.dataset.k && !pl.classList.contains('gone')) {
        pl.classList.add('gone');
        setTimeout(() => {
          if (pl.classList.contains('gone')) {
            pl.innerHTML = '';
            pl.dataset.k = '';
            pl.classList.remove('cheio');
          }
        }, 450);
      }
    } else {
      pl.classList.remove('gone');
      if (pl.dataset.k !== html) {
        pl.innerHTML = html;
        pl.dataset.k = html;
        requestAnimationFrame(() => pl.classList.add('cheio'));
      }
    }
    if ($('#pixBtn')) $('#pixBtn').onclick = savePix;
  }
  /** o Falta pagar entra na fila atrás de Minha conta: primeiro as voltas do círculo (em
   *  cima), depois os riscos das quitações (embaixo), de cima pra baixo */
  function agendaFaltaPagar(pays, nMeus) {
    if (!anim.naTela.settle || anim.settle || seguraRisco || !semCartao()) return;
    anim.settle = agenda(nMeus ? (nMeus - 1) * VOLTA_GAP + DESENHA_GAP + DESENHA_MS : 0);
    anim.risco = agenda(pays.length ? (pays.length - 1) * RISCO_GAP + RISCO_MS : 0);
    pays.forEach((e, i) => anim.riscos.set(e.id, anim.risco + i * RISCO_GAP));
  }
  /** com a fila no fim, o Sou Fulano sublinha e, com a tela parada um tempo, o ✎ se
   *  apresenta. Só depois que cada seção à vista pegou a vez, senão o ✎ furava a fila */
  function agendaSouEFab(hasMe) {
    const aVista = (el) => {
      if (el.classList.contains('hidden')) return false;
      const r = el.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0;
    };
    const pegaram =
      (!aVista($('#mine')) || anim.naTela.mine) &&
      (!aVista($('#itemsSec')) || anim.naTela.itens) &&
      (!aVista($('#settle')) || anim.naTela.settle);
    if (!pegaram || $('#app').classList.contains('loading') || !hasMe || anim.fab || ficha.vem() || !semCartao())
      return;
    if (!anim.sou) {
      anim.sou = calmo(SOU_MS, 0);
      cutuca($('#whoBtn'), 'cutuca', anim.sou);
    }
    if ((+device().fabTaps || 0) < 3) {
      anim.fab = calmo(ANOTA_MS, ANOTA_RESPIRO);
      cutuca($('#fab'), 'pulsa', anim.fab);
    } else anim.fab = -1;
  }
  /** Minha conta: o saldo de quem está vendo e, devendo, um ✔ e um copiar pix por pessoa */
  function renderMinha(bal, acerto) {
    $('#mine').classList.remove('hidden');
    const meus = bal < 0 ? acerto.filter((t) => t.from === me) : [],
      recebe = bal > 0 ? acerto.filter((t) => t.to === me) : [];
    agendaMinha(meus, recebe.length);
    // o copiar pix corre por fora da fila: brota de trás do ✔ assim que a chave chega, e
    // brotar já conta que chegou (nada de spinner). O #mineRows é refeito a cada poll: o
    // atraso negativo retoma a animação de onde estava, aqui e na piscada
    const botaoCopiarPix = (t) => {
      if (!pixReady || !pixKeys[t.to]) return '';
      if (!anim.pix.has(t.to)) anim.pix.set(t.to, Date.now());
      const dt = Date.now() - anim.pix.get(t.to);
      const br = dt < PIX_MS ? ` brota" style="animation-delay:${-dt}ms` : '';
      return `<button class="ico${br}" data-pix="${t.to}|${t.cents}" title="copiar pix">${PIX_SVG} copiar pix</button>`;
    };
    // toda linha pisca, tenha chave de pix ou não: a conta é a mesma. Uma atrás da outra
    const botaoPaguei = (t, i) => {
      const esp = i * PISCA_GAP,
        dt = anim.mine ? Date.now() - anim.mine : Infinity;
      const natal = anim.natal,
        j = natal && natal[i],
        fecho = j && (natal.length - 1) * PISCA_GAP + FECHO_EM + j[1];
      // o que entra no class (e no style) do botão: nada, a piscada simples ou o pisca-pisca de natal
      const piscada = () => {
        if (anim.tocouOk) return '';
        if (j) {
          if (dt >= fecho + FECHO_MS) return '';
          return ` pisca natal${i % 2 ? ' b' : ''}" style="animation-delay:${Math.round(esp + j[0] - dt)}ms,${Math.round(fecho - dt)}ms`;
        }
        if (dt >= esp + PISCA_MS) return '';
        return ` pisca" style="animation-delay:${esp - dt}ms`;
      };
      const pi = piscada();
      return `<button class="ico ok${pi}" data-settle="${t.from}|${t.to}|${t.cents}" title="quitar">✔ paguei</button>`;
    };
    const valor = (t) =>
      `<span class="cur">${CURRENCY}</span><a class="link num" style="color:inherit" title="copiar valor" data-copy-value="${reais(t.cents)}">${reais(t.cents)}</a>`;
    // quem recebe também age, um botão por linha: dívida pequena se perdoa, o resto "recebi" (se RECEBI)
    // (pagaram por fora e ninguém tocou no ✔). Os dois viram pagamento
    // o cobrar pisca como o ✔ paguei, linha atrás da linha; depois da piscada o recebi (ou o
    // perdoar) brota de trás dele sem piscar, como o copiar pix sai de trás do ✔
    const piscaCobra = (i) => {
      const esp = i * PISCA_GAP,
        dt = anim.mine ? Date.now() - anim.mine : Infinity;
      return anim.tocouOk || dt >= esp + COBRA_MS ? '' : ` pisca" style="animation-delay:${esp - dt}ms`;
    };
    const brotaRecebe = (i) => {
      const esp = i * PISCA_GAP + COBRA_MS,
        dt = anim.mine ? Date.now() - anim.mine : Infinity;
      return anim.tocouOk || dt >= esp + BROTA_MS ? '' : ` brota" style="animation-delay:${esp - dt}ms`;
    };
    const botoesRecebe = (t, i) => {
      const d = `${t.from}|${t.to}|${t.cents}`,
        pi = brotaRecebe(i);
      if (t.cents < PERDOA_ATE)
        return `<button class="ico${pi}" data-perdoa="${d}" title="perdoar a dívida">🙏🏽 perdoar</button>`;
      return RECEBI
        ? `<button class="ico${pi}" data-recebi="${d}" title="marcar como recebido">🫱🏿‍🫲🏻 recebi</button>`
        : '';
    };
    // os botões dizem o que fazem ("paguei", "copiar pix"): balão explicando ícone é recado solto, e a pessoa pula
    const quem =
      bal > 0
        ? recebe.map((t, i) =>
            linha(
              `<span class="n">${nomeHtml(t.from)}</span><span class="dupla"><button class="ico cobra${piscaCobra(i)}" data-cobra="${t.from}|${t.cents}" title="cobrar no zap">${WA_SVG} cobrar</button>${botoesRecebe(t, i)}</span>`,
              valorHtml(t.cents),
              'sub',
            ),
          )
        : meus.map((t, i) =>
            linha(
              `<span class="n">${nomeHtml(t.to)}</span><span class="dupla">${botaoPaguei(t, i)}${botaoCopiarPix(t)}</span>`,
              valor(t),
              'sub',
            ),
          );
    // quite vira um recado só: o subtítulo lá em cima já diz que você não deve nada
    $('#mineRows').innerHTML =
      (bal === 0
        ? `<div class="empty vazio quite">tudo quite! ${festeja()}</div>`
        : linha(bal > 0 ? 'me devem' : 'eu devo', valorHtml(bal), bal > 0 ? 'pos' : 'neg')) +
      quem.join('') +
      (bal > 0 ? botaoTrocaZap(recebe) : '') +
      (bal > 0 && temAviso() ? botaoAviso() : '');
  }
  /** quem já tem zap guardado (ou pulado) cobra direto, sem cartão: daqui troca ou esquece o número */
  const botaoTrocaZap = (recebe) => {
    const gente = recebe.map((t) => t.from).filter((id) => zapDe(id) !== null);
    return gente.length
      ? `<div class="c trocaZap">trocar o zap de ${gente.map((id) => `<a class="link" data-trocazap="${id}">${esc(nameOf(id))}</a>`).join(', ')}</div>`
      : '';
  };
  /** o 🔔 no pé de Minha conta, só pra quem recebe e ainda não ligou: ligado, some (quem quiser
   *  desligar desliga nas notificações do próprio navegador) */
  const botaoAviso = () =>
    avisoLigado()
      ? ''
      : '<div class="aviso"><button class="ico" data-aviso title="avisar no celular">🔔 me avisa quando pagarem</button></div>';
  /** Minha conta pega a vez assim que chega na tela, sem esperar a chave do pix (senão o
   *  Falta pagar tomava a frente). A fila só segura o começo das piscadas: quem vem depois
   *  não espera elas acabarem, e sem linha nenhuma não há o que segurar */
  /** @param {Transfer[]} meus @param {number} [recebe] quantas linhas de quem me deve: piscam sem natal */
  function agendaMinha(meus, recebe = 0) {
    if (!anim.naTela.mine || anim.mine) return;
    // o pisca-pisca de natal é presente de quem deve pra dois ou mais: sempre na
    // primeira vez que a pessoa vê a própria conta assim, depois cara ou coroa
    const vistos = room().lightsSeen,
      ja = Array.isArray(vistos) && vistos.includes(me);
    anim.natal =
      meus.length >= 2 && (!ja || Math.random() < 0.5)
        ? meus.map(() => [Math.random() * NATAL_JIT, Math.random() * FECHO_JIT])
        : null;
    if (anim.natal && !ja)
      mexe(roomKey(groupId), (o) => {
        o.lightsSeen = [...(Array.isArray(o.lightsSeen) ? o.lightsSeen : []), me];
      });
    const n = meus.length || recebe;
    const fim = !n
      ? 0
      : (n - 1) * PISCA_GAP +
        (!meus.length ? COBRA_MS + BROTA_MS : anim.natal ? FECHO_EM + FECHO_JIT + FECHO_MS : PISCA_MS);
    anim.mine = agenda(n ? (n - 1) * PISCA_GAP + PISCA_LEAD : 0, fim);
  }
  /** o select de quem pagou e os chips de quem divide, guardando o que a pessoa já marcou */
  function renderForm() {
    const payerSel = $('#payer'),
      prevPayer = payerSel.value || me;
    payerSel.innerHTML = state.people.map((p) => `<option value="${p.id}">${esc(p.name)} pagou</option>`).join('');
    if (state.people.some((p) => p.id === prevPayer)) payerSel.value = prevPayer;
    const prev = inputs('#splitChips input');
    const known = new Set(prev.map((i) => i.value)),
      checked = new Set(prev.filter((i) => i.checked).map((i) => i.value));
    $('#splitChips').innerHTML = state.people
      .map((p) => {
        const on = !known.has(p.id) || checked.has(p.id);
        return `<label class="chip ${on ? 'on' : ''}"><input type="checkbox" value="${p.id}" ${on ? 'checked' : ''}>${esc(p.name)}</label>`;
      })
      .join('');
    updateHint();
  }
  /** Falta pagar: quem paga quem (as suas linhas circuladas) e as últimas quitações, carimbadas */
  function renderAcerto(hasMe, acerto, pays, nMeus) {
    const dtS = anim.settle ? Date.now() - anim.settle : Infinity;
    const desenha = dtS < DESENHA_MS + DESENHA_GAP + Math.max(0, nMeus - 1) * VOLTA_GAP;
    let ordem = 0; // as suas linhas riscam uma atrás da outra, de cima pra baixo
    const deve = acerto
      .map((t) => {
        const meu = t.from === me,
          o = meu ? ordem++ : 0;
        return linha(
          `${nomeHtml(t.from)} → ${nomeHtml(t.to)}`,
          valorHtml(t.cents),
          meu ? 'mine' + (desenha ? ' risca' : '') : '',
          '',
          meu ? markStyle(t.from + t.to, markForte(me)) + (desenha ? `;--rd2:${o * VOLTA_GAP - dtS}ms` : '') : '',
          meu ? ` data-copy-value="${reais(t.cents)}" title="copiar valor"` : '',
        );
      })
      .join('');
    const nada = state.expenses.length
      ? '<div class="empty">tudo quitado 🎉</div>'
      : `<div class="empty vazio${hasMe ? ' anota' : ''}">nada anotado ainda.<br><b>${hasMe ? `${LAPIS_SVG} toque aqui pra anotar o primeiro gasto.` : 'diga quem você é aí em cima pra começar.'}</b></div>`;
    const pagos = pays
      .map((e) => {
        const st = stampStyle(e.id),
          cor = colorOf(e.payer);
        const quem = `<span class="n">${tagNovo(e)}${nomeHtml(e.payer)} → ${nomeHtml(e.among[0])}</span>`;
        const desfaz = DESFAZER ? ` data-undo="${e.id}"` : '';
        // perdão é pagamento com outro carimbo; o "por" aparece quando quem perdoou não é quem recebe
        const [selo, quando] = e.forgiven ? ['PERDOADO', 'perdoado'] : ['PAGO', 'pago'];
        const carimbo = `<span class="stampbox"><span class="stamp"${desfaz} style="color:${cor};${st.css}" title="${quando} em ${new Date(e.at).toLocaleDateString('pt-BR')}">${selo}</span></span>`;
        const dono = e.forgiven ? e.among[0] : e.payer;
        const por = autorNome(e) && !anotouQuem(e, dono) ? `<div class="small">por ${esc(autorNome(e))}</div>` : '';
        return linha(quem + carimbo, valorHtml(centavos(e)), 'paid' + st.cls, '', `--ri:${cor};${st.rd}`) + por;
      })
      .join('');
    $('#settle').innerHTML = (deve || nada) + pagos;
  }
  /** a lista dos itens, do mais novo pro mais velho, separada por dia quando tem mais de um */
  function renderItens() {
    const items = state.expenses.filter((e) => e.kind !== 'payment');
    const all = [...items].reverse(),
      list = showAll ? all : all.slice(0, 10);
    const dayOf = (e) =>
      new Date(e.at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const days = new Set(all.map(dayOf));
    let lastDay = null;
    // editar troca o item por outro: o que saiu fica no `gone` com `to`, e vale a última edição
    const editou = new Map(state.gone.filter((g) => g.to).map((g) => [g.to, g]));
    $('#expenses').innerHTML =
      list
        .map((e) => {
          let head = '';
          if (days.size > 1) {
            const d = dayOf(e);
            if (d !== lastDay) {
              head = `<div class="day">${esc(d)}</div>`;
              lastDay = d;
            }
          }
          const g = editou.get(e.id);
          // o que era antes: só o que mudou, descrição e/ou valor
          const era = g
            ? [g.desc !== e.desc ? esc(g.desc) : '', centavos(g) !== centavos(e) ? reais(centavos(g)) : '']
                .filter(Boolean)
                .join(' de ')
            : '';
          const by = g
            ? `<span class="by"> · editado${autorNome(g) ? ` por ${autorHtml(g)}` : ''}${era ? ` · era ${era}` : ''}</span>`
            : autorNome(e) && !anotouQuem(e, e.payer)
              ? `<span class="by"> · anotado por ${autorHtml(e)}</span>`
              : '';
          const meu = e.byId || e.by ? anotouQuem(e, me) : !!me && e.payer === me;
          const botoes = meu
            ? `<button class="edita" data-edit-expense="${e.id}" title="editar">editar</button><button class="danger" data-del-expense="${e.id}" title="Excluir" aria-label="excluir o gasto ${esc(e.desc)}">✕</button>`
            : '';
          return (
            head +
            `<div class="item ${openItems.has(e.id) ? 'open' : ''}" data-item="${e.id}">` +
            linha(`${tagNovo(e) || tagMudou(g)}${esc(e.desc)}`, reais(centavos(e))) +
            `<div class="small"><span>${nomeHtml(e.payer)} pagou · ${howText(e, nomeHtml, true)}${by}</span>${botoes}</div></div>`
          );
        })
        .join('') || '<div class="empty">nada anotado ainda</div>';
    const tg = $('#toggleAll');
    tg.classList.toggle('hidden', all.length <= 10);
    // os apagados ficam recolhidos no fim: a lista não se enche de risco, e "cadê a janta?" está a um toque.
    // A edição que perdeu pra outra feita ao mesmo tempo fica junto, dizendo de quem era e qual valeu
    const gone = state.gone.filter((g) => !g.to).reverse();
    const sobrescritas = gone.filter((g) => g.lostTo).length,
      apagados = gone.length - sobrescritas;
    const dia = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const deQuem = (g) => (autorNome(g) ? ` de ${autorHtml(g)}` : '');
    /** @param {Gone} g */
    const porQue = (g) => {
      if (!g.lostTo) return `apagado${autorNome(g) ? ` por ${autorHtml(g)}` : ''}`;
      const ganhou = state.gone.find((x) => x.to === g.lostTo);
      return `edição${deQuem(g)}, sobrescrita ${ganhou ? `pela${deQuem(ganhou)}` : 'por outra'}`;
    };
    const resumo = [
      apagados ? `${apagados} ${apagados === 1 ? 'item apagado' : 'itens apagados'}` : '',
      sobrescritas ? `${sobrescritas} ${sobrescritas === 1 ? 'edição sobrescrita' : 'edições sobrescritas'}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    $('#gone').innerHTML = gone.length
      ? `<div class="c small"><a class="link" id="goneToggle">${showGone ? '▾' : '▸'} ${resumo}</a></div>` +
        (showGone
          ? gone
              .map(
                (g) =>
                  `<div class="item apagado" data-gone="${g.id}">` +
                  linha(esc(g.desc), reais(centavos(g))) +
                  `<div class="small"><span>${porQue(g)} · ${dia(g.goneAt)}</span></div></div>`,
              )
              .join('')
          : '')
      : '';
    if (gone.length)
      $('#goneToggle').onclick = () => {
        showGone = !showGone;
        render();
      };
    tg.textContent = showAll ? 'ver menos' : `ver todos os ${all.length} itens`;
    if (itemsOpen) anim.viuItens = true;
    $('#itemsCount').textContent =
      `${anim.viuItens ? '' : all.length === 1 ? 'ver ' : 'ver os '}${all.length} ${all.length === 1 ? 'item' : 'itens'}`;
    const ih = $('#itemsHead');
    ih.classList.toggle('aberto', itemsOpen);
    ih.setAttribute('aria-expanded', String(itemsOpen));
    $('#itemsCaret').classList.toggle('aberto', itemsOpen);
    // a linha é o mesmo elemento em todo render: o atraso é marcado uma vez só, senão
    // mexer nele reiniciaria a animação. Abriu no meio do convite, ele para ali
    if (itemsOpen) ih.classList.remove('pisca', 'suave');
    else if (anim.itens > 0 && !ih.dataset.pisca) {
      ih.dataset.pisca = '1';
      ih.style.setProperty('--ad', `${anim.itens - Date.now()}ms`);
      ih.classList.add(anim.suave ? 'suave' : 'pisca');
    }
    $('#itemsBody').classList.toggle('hidden', !itemsOpen);
    $('#total').innerHTML = valorHtml(items.reduce((a, e) => a + centavos(e), 0));
  }
  // #endregion
  // #region o anotar
  // ---------- o anotar (o formulário de gasto) ----------
  const customShares = () => {
    const o = {};
    for (const i of inputs('#sharesBox input[data-share]')) o[i.dataset.share] = lerCentavos(i.value) || 0;
    return o;
  };
  const totalDigitado = () => lerCentavos($('#amount').value) || 0;
  /** o jeito de dividir são duas abas: "igual" (os chips de quem divide) e "partes
   *  diferentes" (uma linha por pessoa, com o ✔ de quem entra e o valor dela). A lista
   *  é uma só: nas partes diferentes os chips somem, e marcar a linha marca o chip */
  function updateHint() {
    const among = inputs('#splitChips input:checked').map((i) => i.value);
    const payer = $('#payer').value;
    const h = $('#splitHint');
    const custom = splitMode === 'custom';
    for (const b of inputs('#splitSeg button')) {
      const on = b.dataset.modo === splitMode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    }
    $('#splitSeg').classList.toggle('direita', custom);
    $('#splitChips').classList.toggle('hidden', custom);
    $('#sharesBox').classList.toggle('hidden', !custom);
    $('#falta').classList.toggle('hidden', !custom);
    if (custom) {
      // as linhas só se refazem quando muda quem aparece nelas: todo sync passa por aqui, e
      // refazer a cada um tirava o campo (e o teclado) de quem estava digitando a parte
      const box = $('#sharesBox'),
        k = JSON.stringify(state.people.map((p) => [p.id, p.name, among.includes(p.id)]));
      if (box.dataset.k !== k) {
        box.dataset.k = k;
        const prev = customShares();
        box.innerHTML = state.people
          .map((p) => {
            const on = among.includes(p.id);
            return (
              `<div class="row lin${on ? '' : ' off'}"><label class="ck"><input type="checkbox" data-quem="${p.id}" ${on ? 'checked' : ''} aria-label="${esc(p.name)} divide"></label><span class="l">${nomeHtml(p.id)}</span><span class="d"></span>` +
              (on
                ? `<button type="button" class="resto" data-resto="${p.id}">o resto</button><input type="text" inputmode="numeric" autocomplete="off" placeholder="0,00" data-share="${p.id}" value="${prev[p.id] ? reais(prev[p.id]) : ''}">`
                : '<span class="fora">fora</span>') +
              '</div>'
            );
          })
          .join('');
      }
      // a frase fica nas duas abas, pra nada sumir do nada quando se troca
      h.innerHTML = !among.length ? 'Marque quem divide esse gasto.' : 'Dividido <u>em partes diferentes</u>.';
      atualizaFalta();
      return;
    }
    $('#expenseForm button.big').disabled = false;
    // com o valor digitado, a frase já diz quanto fica pra cada um: quem digitou 90 pra uma
    // pizza de R$ 90 vê o "R$ 0,30 cada" antes de anotar, e não depois
    const total = totalDigitado();
    if (!among.length) h.textContent = 'Marque quem divide esse gasto.';
    else if (!among.includes(payer))
      h.textContent = `Empréstimo: ${among.map(nameOf).join(', ')} deve${among.length === 1 ? '' : 'm'} ${total > 0 ? quinhao(total, among) : 'o valor todo'} a ${nameOf(payer)}.`;
    // a frase fica em cima das abas e só conta como está dividido: quem troca são as abas
    else
      h.innerHTML =
        `Dividido <u>igualmente</u> entre <u>${among.length} pessoa${among.length === 1 ? '' : 's'}</u>` +
        (total > 0 ? `, ${quinhao(total, among)}.` : '.');
  }
  /** quanto fica pra cada um: "R$ 30,00 cada", ou "R$ 33,34 e R$ 33,33" quando sobra centavo
   *  @param {number} total em centavos @param {string[]} ids */
  function quinhao(total, ids) {
    const [maior, menor] = [...new Set(Object.values(shares(total, ids)))];
    if (menor !== undefined) return `${comSifrao(maior)} e ${comSifrao(menor)}`;
    return ids.length === 1 ? comSifrao(maior) : `${comSifrao(maior)} cada`;
  }
  /** trocar de aba sem tranco: a área de baixo muda de altura devagar (o papel, centrado,
   *  cresce pros dois lados junto) e o que entra aparece deslizando de leve */
  function trocaAba(modo) {
    const area = $('#splitArea'),
      antes = area.offsetHeight;
    splitMode = modo;
    updateHint();
    if (semMovimento()) return;
    const depois = area.offsetHeight,
      curva = 'cubic-bezier(.3,.9,.4,1)';
    area.animate(
      [
        { height: antes + 'px', overflow: 'hidden' },
        { height: depois + 'px', overflow: 'hidden' },
      ],
      { duration: 300, easing: curva },
    );
    const entra = [...area.children].filter((e) => !e.classList.contains('hidden'));
    for (const e of entra)
      e.animate(
        [
          { opacity: 0, transform: 'translateY(-6px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 260, delay: 60, easing: 'ease-out', fill: 'backwards' },
      );
  }
  /** quanto falta (ou sobra) pras partes fecharem o total, em destaque em cima do botão,
   *  que só libera quando fecha. Só mexe no recado e nos "o resto": refazer as linhas
   *  apagaria o campo em que a pessoa está digitando */
  function atualizaFalta() {
    if (splitMode !== 'custom') return;
    const total = totalDigitado(),
      sh = customShares();
    const resta = total - Object.values(sh).reduce((a, b) => a + b, 0);
    const vazios = inputs('#sharesBox input[data-share]').filter((i) => !lerCentavos(i.value));
    const f = $('#falta');
    f.className = 'falta ' + (!total ? 'neutro' : resta === 0 ? 'ok' : 'erro');
    const dividirResto = vazios.length > 1 ? '<a class="link" id="restoIgual">dividir o resto igual</a>' : '';
    if (!total) f.innerHTML = 'digite o valor do gasto lá em cima.';
    else if (resta === 0) f.innerHTML = `✔ fechou ${comSifrao(total)}.`;
    else if (resta > 0)
      f.innerHTML = `faltam <b>${comSifrao(resta)}</b> pra fechar ${comSifrao(total)}.${dividirResto}`;
    else f.innerHTML = `sobram <b>${comSifrao(-resta)}</b> além de ${comSifrao(total)}.`;
    for (const b of inputs('#sharesBox [data-resto]'))
      b.classList.toggle('hidden', resta <= 0 || sh[b.dataset.resto] > 0);
    // o campo tem a largura do número: os pontinhos da linha correm até perto do valor
    for (const i of inputs('#sharesBox input[data-share]')) {
      const n = Math.max(5, i.value.length) + 1;
      /* cabe a dezena (00,00) antes de crescer */ i.style.width = `calc(${n}ch + ${n}px + 8px)`;
    }
    $('#expenseForm button.big').disabled = !(total > 0 && resta === 0);
  }
  // o valor muda a frase de quanto fica pra cada um (e, nas partes diferentes, o quanto falta)
  $('#amount').addEventListener('input', updateHint);
  document.addEventListener('input', (ev) => {
    const tgt = /** @type {HTMLElement} */ (ev.target);
    if (tgt.matches('#sharesBox input[data-share]')) atualizaFalta();
  });

  // #endregion
  // #region cartões (overlays)
  // ---------- cartões (overlays) ----------
  let overlayCancel = null,
    overlaySticky = false,
    /** @type {HTMLElement | null} quem abriu o cartão: o foco volta pra ele */ overlayDeQuem = null;
  /** devolve o foco pra quem abriu, se ele ainda tá na página */
  const voltaFoco = (el) => {
    if (el && el.isConnected && typeof el.focus === 'function') el.focus({ preventScroll: true });
  };
  /** a tela acesa enquanto o QR tá aberto: tela que escurece, a câmera da turma não pega
   *  @type {WakeLockSentinel | null} */
  let telaAcesa = null;
  const acendeTela = () => {
    // navegador sem wakeLock (ou que recusa, como o de economia de bateria): a tela segue como sempre
    navigator.wakeLock?.request('screen').then(
      (t) => {
        // o cartão fechou antes de o pedido voltar: solta na hora
        if ($('#overlay').classList.contains('hidden') || !$('#overlayBox .qr')) t.release().catch(() => {});
        else telaAcesa = t;
      },
      () => {},
    );
  };
  const apagaTela = () => {
    telaAcesa?.release().catch(() => {});
    telaAcesa = null;
  };
  const overlay = (html, sticky = false) => {
    apagaTela();
    if (semCartao()) overlayDeQuem = /** @type {HTMLElement | null} */ (document.activeElement);
    overlayCancel = null;
    overlaySticky = sticky;
    $('#overlayBox').innerHTML = html;
    $('#overlay').classList.remove('hidden');
  };
  const closeOverlay = () => {
    apagaTela();
    $('#overlay').classList.add('hidden');
    $('#overlay').classList.remove('ensina', 'canto', 'meio', 'cima');
    const de = overlayDeQuem;
    overlayDeQuem = null;
    voltaFoco(de);
  };
  /** toque fora ou Esc: fecha como o voltar, menos o cartão que pede uma escolha */
  const fechaPorFora = () => {
    if (overlaySticky) return;
    const c = overlayCancel;
    overlayCancel = null;
    closeOverlay();
    if (c) c();
  };
  $('#overlay').addEventListener('click', (ev) => {
    if (ev.target.id === 'overlay') fechaPorFora();
  });

  /** `perigo` pinta o botão de vermelho: o que não tem volta não pode parecer um voltar */
  function ask(title, desc, okLabel = 'confirmar', perigo = false) {
    return new Promise((res) => {
      overlay(
        `<h2>${title}</h2>${desc ? `<p class="muted recado">${desc}</p>` : ''}<button id="okBtn" class="big${perigo ? ' perigo' : ''}">${okLabel}</button><div class="c voltar"><button id="cancelBtn" class="ghost">voltar</button></div>`,
      );
      overlayCancel = () => res(false);
      $('#okBtn').onclick = () => {
        closeOverlay();
        res(true);
      };
      $('#okBtn').focus();
      $('#cancelBtn').onclick = () => {
        overlayCancel = null;
        closeOverlay();
        res(false);
      };
    });
  }
  /** `valida` barra o que não serve sem fechar o cartão: o recado e a caixa ficam vermelhos e dão um tranco pro lado */
  /** `carimbo` troca o recado por um carimbo em cima da caixa, na largura dela: a regra fica colada onde se digita */
  function askText(title, desc, placeholder, value = '', okLabel = 'confirmar', valida = null, carimbo = '') {
    return new Promise((res) => {
      const caixa = `<input id="askInput" placeholder="${esc(placeholder)}" value="${esc(value)}">`;
      overlay(
        `<h2>${title}</h2>${desc ? `<p class="muted recado" id="askDesc">${desc}</p>` : ''}<form id="askForm" autocomplete="off">${carimbo ? `<span class="carimbo" id="askDesc">${carimbo}</span>` : ''}${caixa}<button class="big">${okLabel}</button></form><div class="c voltar"><button id="cancelBtn" class="ghost">voltar</button></div>`,
      );
      overlayCancel = () => res(null);
      const erro = ['#askInput', '#askDesc'].map((q) => $(q)).filter(Boolean);
      $('#askInput').addEventListener('input', () => erro.forEach((e) => e.classList.remove('erro')));
      $('#askForm').onsubmit = (ev) => {
        ev.preventDefault();
        const v = $('#askInput').value;
        // errou de novo: tira e põe a classe pra batida recomeçar
        if (valida && !valida(v)) {
          erro.forEach((e) => {
            e.classList.remove('erro');
            void e.offsetWidth;
            e.classList.add('erro');
          });
          return $('#askInput').focus();
        }
        closeOverlay();
        res(v);
      };
      $('#cancelBtn').onclick = () => {
        closeOverlay();
        res(null);
      };
      $('#askInput').focus();
    });
  }
  function showCopy(title, text) {
    overlay(
      `<h2>${title}</h2><p class="muted recado">toque e segure pra copiar</p><code class="box">${esc(text)}</code><div class="c voltar"><button id="cancelBtn" class="ghost">fechar</button></div>`,
    );
    $('#cancelBtn').onclick = closeOverlay;
  }
  // "tô lisa" se digita sozinho no cartão do código, a tela de estreia — só na primeira
  // visita deste aparelho, e uma vez só. No cabeçalho do evento ele fica quieto: ali
  // a pessoa veio ver a conta, não o título.
  // É troca de textContent com setTimeout, não animação CSS: um clip-path animado
  // travava num navegador, e setTimeout não depende do relógio de animação.
  let tituloJaAnimou = false;
  /** @param {HTMLElement | null} el @param {(entrou: boolean, el: HTMLElement) => void} [ponto] o ponto final vira
   * um espaço do tamanho dele, e quem passou `ponto` desenha o que quiser ali (avisado quando entra e sai)
   * @param {() => Promise<void>} [intervalo] no "tô lisa!!!" o título espera isso acabar antes de seguir */
  function digitaTitulo(el, ponto, intervalo) {
    if (!el || tituloJaAnimou || visitas !== 1 || semMovimento()) return;
    tituloJaAnimou = true;
    document.fonts.ready.then(() => {
      if (!el.isConnected) return; // a tela pode ter trocado enquanto a fonte carregava
      // a cadência é de gente de verdade (medida de um vídeo de alguém digitando).
      // `d` é a espera *antes* daquele texto aparecer.
      const BASE = 'tô lisa';
      const LETRAS = [150, 950, 265, 215, 185, 85, 200]; // uma por letra: tropeça no ô, embala no "lis"
      /** @type {{ t: string, d: number, pausa?: boolean }[]} */
      const passos = BASE.split('').map((_, i) => ({ t: BASE.slice(0, i + 1), d: LETRAS[i] }));
      passos.push({ t: BASE + '!', d: 765 }); // olha o que escreveu e crava um !
      passos.push({ t: BASE + '!!', d: 965 }, { t: BASE + '!!!', d: 165, pausa: true }); // volta pra pôr mais um, e emenda o terceiro
      passos.push({ t: BASE + '!!', d: 535 }, { t: BASE + '!', d: 135 }); // pensa melhor e apaga dois
      passos.push({ t: BASE + '!?', d: 700 }); // tenta o ? ... e olha
      passos.push({ t: BASE + '!', d: 885 }, { t: BASE, d: 135 }); // apaga o !? também
      passos.push({ t: BASE + (ponto ? '\u00a0' : '.'), d: 300 }, { t: BASE, d: 900 }); // acaba num ponto, que some pro título ficar igual ao resto
      el.textContent = '';
      el.classList.add('digitando');
      let i = 0;
      const passo = () => {
        if (!el.isConnected) return; // o cartão trocou: o título novo já nasce parado
        if (i >= passos.length) {
          el.classList.remove('digitando');
          return;
        }
        const tinha = el.textContent.length > BASE.length && !/[!?]$/.test(el.textContent);
        el.textContent = passos[i].t;
        const tem = el.textContent.length > BASE.length && !/[!?]$/.test(el.textContent);
        if (ponto && tinha !== tem) ponto(tem, el);
        const atraso = passos[i + 1]?.d ?? 90,
          pausa = passos[i].pausa && intervalo;
        i++;
        // uma coisa de cada vez: a estreia roda no meio do título, não por cima dele
        if (pausa) intervalo().then(() => setTimeout(passo, atraso));
        else setTimeout(passo, atraso);
      };
      setTimeout(passo, passos[0].d);
    });
  }
  /** quem chega pela primeira vez: fichas caindo atrás do cartão e uma comandinha que se anota
   * sozinha (Afonso paga, Bia acerta, Charles fica devendo). Ela espera o título chegar no "tô lisa!!!"
   * e o título espera ela acabar (`rodaComanda`). Roda uma vez por página: o cartão volta depois de
   * um código errado, e ela volta já parada no fim */
  let estreiaRodou = false;
  const CHUVA = [
    // x%, tamanho, segundos pra cruzar a tela, atraso, deriva em px, giro, cor (as da ficha do rodapé)
    [8, 34, 11, -2, 40, 500, ''],
    [78, 46, 14, -9, -60, -300, 'quite'],
    [30, 28, 12, -5, 30, 700, 'recebe'],
    [60, 40, 16, -12, -40, -500, ''],
    [90, 30, 10, -1, -30, 400, 'deve'],
    [18, 52, 15, -7, 50, -720, 'quite'],
    [46, 24, 13, -3, 20, 360, ''],
    [68, 36, 12, -6, 30, 600, 'recebe'],
    [36, 44, 17, -14, -50, -400, 'deve'],
  ];
  function estreia() {
    const parada = estreiaRodou || semMovimento(),
      // mesma conta do digitaTitulo: sem título digitando, a comanda não espera por ele
      digita = visitas === 1 && !tituloJaAnimou && !semMovimento();
    estreiaRodou = true;
    const chuva = semMovimento()
      ? ''
      : `<div class="chuva" aria-hidden="true">${CHUVA.map(
          ([x, s, t, d, vx, r, c]) =>
            `<img class="fichinha ${c}" src="diva.png" alt="" style="--x:${x}%;--s:${s}px;--t:${t}s;--d:${d}s;--vx:${vx}px;--r:${r}deg">`,
        ).join('')}</div>`;
    return `${chuva}<div class="comandinha${parada ? ' parada' : digita ? '' : ' roda'}" aria-hidden="true">
      <div class="row f1"><span class="l">afonso pagou a janta</span><span class="d"></span><span class="v">90,00</span></div>
      <div class="row paid novo f2" style="--ri:${corDe(1)}"><span class="l"><span class="n">bia deve</span><span class="stampbox"><span class="stamp" style="color:${corDe(1)}">pago</span></span></span><span class="d"></span><span class="v">30,00</span></div>
      <div class="row f3"><span class="l">charles deve</span><span class="d"></span><span class="v">30,00</span></div>
      <img class="fichinha cai" src="diva.png" alt="" style="--s:34px"></div>`;
  }
  /** solta a comandinha e avisa quando ela termina (o tempo é o da última animação dela no style.css) */
  const COMANDA_MS = 3600;
  function rodaComanda() {
    const c = $('#overlayBox .comandinha:not(.parada)');
    if (!c) return Promise.resolve();
    c.classList.add('roda');
    return new Promise((ok) => setTimeout(ok, COMANDA_MS));
  }
  /** o ponto final do título é uma ficha: cai quando ele aparece e rola pra fora quando some (foi-se o último pila)
   * @param {boolean} entrou @param {HTMLElement} t */
  function fichaDoPonto(entrou, t) {
    if (!t.isConnected) return;
    // sem medir nada: absoluta e sem left/top, a ficha fica onde o texto acaba (o zoom do desktop não desalinha)
    if (entrou)
      t.insertAdjacentHTML('afterend', '<img class="fichinha ponto" src="diva.png" alt="" aria-hidden="true">');
    else {
      const f = t.parentElement?.querySelector('.fichinha.ponto');
      if (!f) return;
      f.classList.add('foge');
      f.addEventListener('animationend', () => f.remove(), { once: true });
    }
  }
  /** a tela inicial e o cartão do evento são o mesmo cartão: Meus eventos com ✕ e o campo pra outro.
   * Sem evento aberto ele é a tela (não fecha); com evento aberto (toque no nome dele) ganha o copiar
   * link e o voltar, e o evento aberto vem marcado na lista */
  function showGate(msg) {
    const aberto = !!groupId;
    if (!aberto) $('#app').classList.add('loading', 'nospin');
    // quem já tem evento neste aparelho cai na lista; o convite e o foco no campo são pra quem chega
    const evs = meusEventos(),
      botao = evs.length ? 'Entrar' : 'Bora';
    const chegou = !msg && !evs.length && !aberto;
    // o mesmo campo cria e entra: quem chega sem código precisa saber que um nome qualquer já serve
    const intro = chegou
      ? `<div class="c" style="text-transform:none;font-size:18px;line-height:1.4;margin:6px 0 8px">racha a conta do rolê.<br>sem app, sem cadastro.</div>
      ${estreia()}`
      : '';
    const lista = evs.length
      ? `<div class="hr"></div><h2>*** Meus eventos ***</h2>${listaEventos(evs, true)}
      <div class="c muted" style="text-transform:none;margin-top:6px">o ✕ tira da lista só neste aparelho</div>`
      : '';
    overlay(
      `<h1><span id="tituloGate">tô lisa</span></h1>${intro}${
        aberto
          ? `<div class="hr"></div><h2>*** Evento ***</h2>
      <div class="row" style="font-size:19px;color:var(--ink2)"><span class="l">entra quem tem</span><span class="d"></span><span class="v"><a class="link" id="evLink">o link</a></span></div>
      <div class="c"><button id="evQr" class="qrbtn colado">${QR_ICONE} mostrar QR</button></div>`
          : ''
      }${lista}<div class="hr"></div><h2>*** ${evs.length ? 'Outro evento' : 'Evento'} ***</h2>${msg || !evs.length ? `<p class="muted recado"${msg ? '' : ' style="color:var(--ink2);text-wrap:balance"'}>${msg || 'qualquer nome cria o evento.'}</p>` : ''}
      <form id="gateForm" class="lado" autocomplete="off" style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center"><input id="gateCode" placeholder="ex: churras" required autocapitalize="none"><button class="small">${botao}</button></form>
      <p id="gateErr" class="status err" style="margin:0"></p>${linhaDigital(evs.length > 0)}${
        aberto ? `<div class="c voltar"><button id="evBack" class="ghost">voltar</button></div>` : ''
      }${temDados() ? '<div class="c apaga"><button id="apagaTudo" class="ghost">apagar meus dados deste aparelho</button></div>' : ''}`,
      !aberto,
    );
    if (aberto) {
      $('#evBack').onclick = closeOverlay;
      // o link do grupo vai direto pra área de copiar: o "Mandar pra quem?" segue no botão de compartilhar
      $('#evLink').onclick = () => copia(shareUrl(), 'Link copiado. Agora é só colar no grupo.', 'Link do evento');
      // o QR não espera gasto nem gente: logo que o evento nasce, a turma da mesa já entra por ele
      $('#evQr').onclick = mostraQr;
    }
    if (!aberto) digitaTitulo($('#tituloGate'), chegou ? fichaDoPonto : undefined, chegou ? rodaComanda : undefined);
    // se a fonte demora e o título não chega no "!!!", a comanda não fica escondida pra sempre
    if (chegou) setTimeout(() => $('#overlayBox .comandinha')?.classList.add('roda'), 6000);
    // autofocus rolava o cartão até o campo (o título sumia em cima, no notebook) e, no celular, abria o
    // teclado por cima da estreia: o foco vem sem rolar, e só onde tem teclado de verdade
    if (!evs.length && !matchMedia('(pointer: coarse)').matches) $('#gateCode').focus({ preventScroll: true });
    /** @param {MeuEvento} e */
    const esquece = (e) => esqueceEvento(e, () => showGate());
    ligaEventos(evs, esquece);
    atualizaDatas(evs, true, esquece);
    ligaDigital();
    $('#gateForm').onsubmit = async (ev) => {
      ev.preventDefault();
      const btn = ev.target.querySelector('button');
      // dois toques no botão criariam dois eventos: ele fica apagado até a página mudar
      if (btn.disabled) return;
      // com um evento aberto, o outro entra pelo endereço: o começo do app faz o resto
      if (aberto) {
        const { code, quem, link, meu } = codigoDoCampo($('#gateCode').value);
        if (!code) return;
        if (code === roomName) return closeOverlay();
        btn.disabled = true;
        // nome digitado que não existe cria direto, pelo ?novo=; link que não abre nada vai pelo ?evento=, que pergunta
        let novo = false;
        if (!link && !meu && !pareceLink(code) && DB)
          try {
            await apiGet(await sha(code));
          } catch (e) {
            novo = !!e.notFound;
          }
        location.href =
          location.pathname + (novo ? '?novo=' : '?evento=') + encodeURIComponent(code) + (quem ? '&quem=' + quem : '');
        return;
      }
      btn.disabled = true;
      btn.textContent = evs.length ? 'Entrando…' : 'Abrindo…';
      const code = $('#gateCode').value;
      try {
        const c = codigoDoCampo(code);
        quemDoLink = c.quem;
        await enterRoom(c.code, !c.link && !c.meu);
      } catch (e) {
        // o "Não achei …" toma o lugar do cartão: voltando dele, o cartão do código volta junto
        if (!$('#gateForm')) {
          showGate();
          $('#gateCode').value = code;
        }
        $('#gateErr').textContent = e.message;
        btn.disabled = false;
        btn.textContent = botao;
      }
    };
  }
  /** a bolinha da pessoa: só a cor dela, sem letra */
  const bolinha = (p) => `<span class="bola" style="background:${colorOf(p.id)}"></span>`;
  /** primeira vez no evento: monta a lista de gente antes de perguntar quem é você. Cada pessoa é
   * uma bolinha na cor dela, e a casinha vazia do fim já espera a próxima: enter põe e volta pra ela */
  function showSetup() {
    // quem já tem conta no evento (ou é você) não sai pelo ✕: o Quem vai? reabre pelo "+ outra pessoa"
    const temConta = (id) =>
      id === me || state.expenses.some((e) => e.payer === id || e.among.includes(id) || (e.shares && id in e.shares));
    const list = state.people
      .map(
        (p) =>
          `<div class="row pessoa" style="--cor:${colorOf(p.id)}">${bolinha(p)}<span class="l" contenteditable="plaintext-only" spellcheck="false" data-renome="${p.id}">${esc(p.name)}</span><span class="v">${temConta(p.id) ? '' : `<button class="ico" data-drop="${p.id}" title="tirar" aria-label="tirar ${esc(p.name)}">✕</button>`}</span></div>`,
      )
      .join('');
    const n = state.people.length;
    // lista vazia: a turma de um dos meus eventos vem num toque, da cópia do aparelho (abre sem internet)
    const turmas = n
      ? []
      : meusEventos()
          .filter((e) => e.id !== groupId && e.snap && e.snap.people.length)
          .slice(0, 3);
    const trazer = turmas.length
      ? `<div class="hr"></div><div class="c muted recado" style="text-transform:none">ou traga a turma de</div><div class="evs turmas">${turmas
          .map(
            (e) =>
              `<div class="ev" data-turma="${e.id}" role="button" tabindex="0"><div class="row"><span class="l">${esc(e.nome)}</span><span class="d"></span><span class="v">${e.snap.people.length} pessoa${e.snap.people.length === 1 ? '' : 's'}</span></div><div class="sub"><span>${esc(e.snap.people.map((p) => p.name).join(', '))}</span></div></div>`,
          )
          .join('')}</div>`
      : '';
    overlay(
      `<h2 class="pergunta">Quem vai?</h2><div class="c muted recado" style="text-transform:none">um nome por vez, enter pro próximo</div>
      ${list}
      <form id="setupForm" autocomplete="off" class="pessoa nova" style="--cor:${corDe(n)}">
        <span class="bola">+</span><input id="setupName" placeholder="${n ? 'mais alguém?' : 'seu nome'}" maxlength="30" enterkeyhint="next"></form>
      <button id="setupMais" class="ghost casinha">+ outra pessoa</button>${trazer}
      <button id="setupGo" class="big" style="margin-top:14px" ${n ? '' : 'disabled'}>Pronto</button>
      <div class="c voltar"><button id="setupLeave" class="ghost">sair</button></div>`,
    );
    // o nome que ficou na caixa também entra: no Pronto e no +, ninguém perde o que digitou
    // no Pronto, um nome repetido na caixa só fica de fora: a pessoa já está na lista
    const poe = (pronto = false) => {
      const name = $('#setupName').value.trim();
      if (!name) return true;
      if (nomeExiste(name)) return pronto || (toast('Já existe alguém com esse nome'), false);
      state.people.push({ id: uid(), name, at: Date.now() });
      commit();
      return true;
    };
    // a cor de quem entra já é sabida (é a da próxima posição, corDe(n)): a casinha pinta na primeira letra
    $('#setupName').oninput = () => {
      const tem = !!$('#setupName').value.trim();
      $('#setupForm').classList.toggle('digitando', tem);
      $('#setupGo').disabled = !state.people.length && !tem;
    };
    // tocar no nome deixa editar ali mesmo: enter ou sair da caixa grava; vazio ou repetido volta ao que era
    for (const el of inputs('#overlayBox [data-renome]')) {
      const p = state.people.find((x) => x.id === el.dataset.renome);
      if (!p) continue;
      el.onkeydown = (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          el.blur();
        }
        if (ev.key === 'Escape') {
          ev.preventDefault(); // desfaz o nome, sem fechar o cartão
          el.textContent = p.name;
          el.blur();
        }
      };
      el.onblur = () => {
        const novo = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30);
        if (novo === p.name) return void (el.textContent = p.name);
        if (!novo || state.people.some((x) => x.id !== p.id && x.name.toLowerCase() === novo.toLowerCase())) {
          if (novo) toast('Já existe alguém com esse nome');
          return void (el.textContent = p.name);
        }
        p.name = renomes[p.id] = novo;
        el.textContent = novo;
        commit();
      };
    }
    $('#setupForm').onsubmit = (ev) => {
      ev.preventDefault();
      if ($('#setupName').value.trim() && poe()) showSetup();
    };
    $('#setupMais').onclick = () => (poe() ? showSetup() : $('#setupName').focus());
    // o ✕ vai pro deleted também: senão o merge() traz a pessoa de volta do banco no próximo sync
    for (const b of inputs('#overlayBox [data-drop]'))
      b.onclick = () => {
        state.people = state.people.filter((p) => p.id !== b.dataset.drop);
        state.deleted.push(b.dataset.drop);
        commit();
        showSetup();
      };
    for (const el of inputs('#overlayBox [data-turma]')) {
      const e = turmas.find((x) => x.id === el.dataset.turma);
      if (!e) continue;
      el.onclick = () => showTurma(e);
      el.onkeydown = (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          showTurma(e);
        }
      };
    }
    // evento de uma pessoa só: não há o que perguntar, quem criou é ela. Quem veio com a turma já é alguém
    // quem já é alguém e voltou pra pôr mais gente só fecha: continua sendo quem era. Com duas ou mais
    // e ninguém escolhido, também só fecha: o "Quem é você?" do topo da nota já pergunta, com os nomes
    $('#setupGo').onclick = () => {
      if (!poe(true) || !state.people.length) return;
      if (!temMe() && state.people.length === 1) return souEu(state.people[0].id);
      closeOverlay();
      render();
    };
    // sair (ou tocar fora) só fecha: a nota fica esperando o toque no "quem é você?"
    $('#setupLeave').onclick = closeOverlay;
    $('#setupName').focus();
  }
  /** a turma de outro evento: as mesmas pessoas, com os mesmos ids e na mesma ordem (a cor de
   *  cada uma vem junto), e eu continuo sendo quem eu era lá. Gasto nenhum vem. Chave pix, só
   *  a minha, gravada de novo com um tok deste evento: a dos outros travaria a deles aqui
   *  @param {MeuEvento} e */
  function showTurma(e) {
    const gente = /** @type {Room} */ (e.snap).people,
      fora = new Set(),
      chave = e.me ? minhaChave() : '';
    const desenha = () => {
      const ficam = gente.filter((p) => !fora.has(p.id)),
        vem = ficam.length;
      // a cor é a que a pessoa vai ter no evento novo: quem fica de fora empurra as de trás
      const cor = (p) => PALETTE[Math.max(0, ficam.indexOf(p)) % PALETTE.length];
      overlay(
        `<h2 class="pergunta">A turma de ${esc(e.nome)}</h2><div class="c muted recado" style="text-transform:none">toque em quem não vai</div>
        <div class="chips turma">${gente
          .map(
            (p) =>
              `<button class="chip${fora.has(p.id) ? '' : ' on'}" data-quem="${p.id}" style="--cor:${cor(p)}"><span class="bola"></span>${esc(p.name)}${p.id === e.me ? ' (eu)' : ''}</button>`,
          )
          .join('')}</div>
        ${chave && !fora.has(e.me) ? `<div class="c turmaPix"><label class="chip on"><input type="checkbox" id="turmaPix" checked>usar minha chave pix</label><div class="muted">${esc(chave)}</div></div>` : ''}
        <button id="turmaGo" class="big" style="margin-top:14px" ${vem ? '' : 'disabled'}>trazer ${vem} pessoa${vem === 1 ? '' : 's'}</button>
        <div class="c voltar"><button id="turmaVolta" class="ghost">voltar</button></div>`,
      );
      for (const b of inputs('#overlayBox [data-quem]'))
        b.onclick = () => {
          const id = b.dataset.quem;
          if (fora.has(id)) fora.delete(id);
          else fora.add(id);
          desenha();
        };
      if ($('#turmaPix'))
        $('#turmaPix').onchange = () => $('#turmaPix').closest('.chip').classList.toggle('on', $('#turmaPix').checked);
      $('#turmaVolta').onclick = showSetup;
      $('#turmaGo').onclick = () => {
        const comPix = !!$('#turmaPix') && $('#turmaPix').checked;
        const jaTem = (p) => state.people.some((x) => x.id === p.id || x.name.toLowerCase() === p.name.toLowerCase());
        for (const p of gente)
          if (!fora.has(p.id) && !state.deleted.includes(p.id) && !jaTem(p))
            state.people.push({ id: p.id, name: p.name, at: p.at });
        state.people.sort((a, b) => a.at - b.at);
        commit();
        if (e.me && state.people.some((p) => p.id === e.me)) {
          souEu(e.me);
          if (comPix) putPix(e.me, chave);
        }
        showSetup();
      };
    };
    desenha();
  }
  // trocar de pessoa é uma nota nova: o risco, as voltas do círculo e a piscada
  // do ✔ recomeçam, senão a conta do outro aparece já riscada e parada
  function souEu(v) {
    me = v;
    setRoom('me', me);
    if (temMe()) setDevice('myName', nameOf(me)); // o palpite de quem eu sou num evento que não tem a minha turma
    rearmaAnims();
    closeOverlay();
    render();
    $('#payer').value = me;
    updateHint();
    ficha.rejoga();
  }
  /** quem ainda não é ninguém escolhe com um toque no nome, os mesmos botões do topo da nota; quem já
   *  é alguém vê o próprio nome no menu, que só abre se tocar pra trocar */
  function showWho() {
    if (!temMe()) {
      overlay(`<h2>Quem é você?</h2>${linkpras(state.people, 'sou')}
      <div class="c voltar"><a class="link" id="whoNova">+ outra pessoa</a></div>`);
      for (const b of inputs('#overlayBox [data-sou]')) b.onclick = () => souEu(b.dataset.sou);
      // "+ outra pessoa" leva pro Quem vai?, onde dá pra pôr uma ou várias de uma vez
      $('#whoNova').onclick = showSetup;
      return;
    }
    const opts = state.people
      .map((p) => `<option value="${p.id}"${p.id === me ? ' selected' : ''}>${esc(p.name)}</option>`)
      .join('');
    overlay(`<h2>Quem é você?</h2>
      <form id="whoForm"><select id="whoSel">${opts}<option value="__new">+ outra pessoa</option></select></form>${whoPix()}`);
    // escolher já é confirmar: quem é você não tem botão de continuar. "+ outra pessoa" leva pro
    // Quem vai?, sem deixar de ser quem você é
    $('#whoSel').onchange = () => {
      const v = $('#whoSel').value;
      if (v === '__new') return showSetup();
      if (v) souEu(v);
    };
    $('#whoForm').onsubmit = (ev) => ev.preventDefault();
    if ($('#pixTroca')) $('#pixTroca').onclick = savePix;
    if ($('#pixNova')) $('#pixNova').onclick = savePix;
    if ($('#pixApaga'))
      $('#pixApaga').onclick = async () => {
        if (await ask('Apagar a chave pix?', esc(pixKeys[me]), 'apagar', true)) putPix(me, '');
      };
  }
  // trocar e apagar a chave só aparecem no aparelho que cadastrou: é ele que tem o tok
  // o cartão nunca fica mudo sobre o pix: sem chave, cadastra; com chave de outro aparelho, diz por que não troca
  function whoPix() {
    if (!me || !pixReady) return '';
    const k = pixKeys[me];
    const corpo = !k
      ? `<div class="c"><button class="ico amb" id="pixNova">${PIX_SVG}${KEY_SVG} cadastrar chave pix</button></div>`
      : linha('meu pix', esc(k), '', '', '', ' style="text-transform:none"') +
        ((room().pixTokens || {})[me]
          ? `<div class="c" style="margin-top:8px;display:flex;gap:10px;justify-content:center"><button class="small" id="pixTroca">trocar</button><button class="small ghost" id="pixApaga" style="color:var(--red)">apagar</button></div>`
          : `<p class="muted" id="pixOutro" style="margin:6px 0 0;text-align:center;text-transform:none">cadastrada em outro aparelho: só ele troca</p>`);
    return `<div id="whoPix"><div class="hr"></div>${corpo}</div>`;
  }
  function showLost() {
    clearInterval(pollTimer);
    $('#app').classList.add('loading', 'nospin');
    const cached = cacheLoad();
    overlay(
      `<h2>Sumiu!</h2><p class="muted recado">${cached ? 'esse evento não tá mais aqui, mas teu celular guardou uma cópia.' : 'esse evento não tá mais aqui. confere o nome com quem te mandou.'}</p>
      ${cached ? `<button id="restoreBtn" class="big">trazer de volta</button>` : ''}<div class="c" style="margin-top:8px"><button id="lostBack" class="ghost">voltar</button></div>`,
      true,
    );
    if (cached)
      $('#restoreBtn').onclick = async () => {
        try {
          await apiPut(groupId, cached);
          location.reload();
        } catch (e) {
          toast('Não deu pra trazer de volta, tenta de novo');
        }
      };
    // o evento não existe mais: sai da lista também (a gaveta fica, com a cópia e o tok do pix)
    $('#lostBack').onclick = () => {
      esconde(groupId);
      leave();
    };
  }

  // #endregion
  // #region entrar num evento
  // ---------- entrar num evento (código → id no banco) ----------
  /** o que a pessoa pôs no campo vira código. O que ela tem no zap é o link, sozinho ou no meio da
   *  mensagem: o código sai do ?evento= (ou do ?senha= antigo) e o &quem= do mesmo link vem junto.
   *  Nome igual ao de um evento da lista é esse evento, não um novo com o mesmo nome
   *  (`meu`: o evento pode ter sumido do banco, e aí ele pergunta antes de criar outro em silêncio)
   *  @returns {{ code: string, quem: string|null, link: boolean, meu?: boolean }} */
  function codigoDoCampo(texto) {
    const t = texto.trim(),
      // só o que o encodeURIComponent gera: o <input> tira a quebra de linha, e o texto de depois grudaria no código
      m = t.match(/[?&](?:evento|senha)=([\w%.~!*'()-]+)/);
    if (m) {
      const link = t.slice(m.index).split(/\s/)[0],
        q = link.match(/[?&]quem=([\w%.~!*'()-]+)/);
      let code = m[1];
      try {
        code = decodeURIComponent(code.replace(/\+/g, ' '));
      } catch {}
      return { code: code.trim().toLowerCase(), quem: q && /^[a-z0-9]{1,32}$/.test(q[1]) ? q[1] : null, link: true };
    }
    const code = t.toLowerCase(),
      evs = meusEventos(),
      meu = evs.find((e) => e.code === code) || evs.find((e) => e.nome.trim().toLowerCase() === code);
    return { code: meu ? meu.code : code, quem: null, link: false, meu: !!meu };
  }
  /** código com cara de final sorteado (6 letras e números, com algum número): veio de um link */
  function pareceLink(code) {
    return /-(?=[a-z]*\d)[a-z0-9]{6}$/.test(code);
  }
  /** `digitou` é o nome escrito no campo, que cria sem perguntar */
  async function enterRoom(code, digitou = false) {
    if (!code) throw new Error('digita um nome.');
    if (!DB) throw new Error('site em manutenção, volta já.');
    let id = await sha(code),
      existing = null;
    try {
      existing = await apiGet(id);
    } catch (e) {
      if (!e.notFound) throw new Error('sem internet ou o banco cochilou. tenta de novo?');
    }
    let criou = false;
    const seed = location.hash.match(/#seed=([A-Za-z0-9+/=_-]+)/);
    // nome digitado no campo é pedido de evento: cria direto. Só pergunta o que chegou por link
    if (!existing && !seed && (pareceLink(code) || !digitou)) {
      // código com cara de final sorteado é link velho ou cortado, não nome novo:
      // "esse nome tá livre" ali faria a pessoa criar um evento fantasma
      const [titulo, desc, ok] = pareceLink(code)
        ? [
            `Não achei "${esc(code)}"`,
            'esse link não abre evento nenhum. confere com quem te mandou.',
            'criar mesmo assim',
          ]
        : [
            `Criar "${esc(code)}"?`,
            'esse nome tá livre. o link ganha um final sorteado, à prova de enxerido.',
            'criar',
          ];
      if (!(await ask(titulo, desc, ok))) throw new Error('nada foi criado.');
    }
    if (!existing && !seed) {
      // código curto ("churras") se adivinha testando o hash direto no banco: o evento novo
      // vira "churras-k7f3q9", e o nome da tela continua "churras". 36⁶ finais possíveis
      const nome = code;
      criou = true;
      code = `${code}-${sorteia(6)}`;
      id = await sha(code);
      await apiPut(id, fresh(nome));
    } else if (!existing) {
      // #seed=: restaura uma cópia com o mesmo código, sem sortear nada
      let data = fresh(code);
      try {
        data = {
          ...fresh(code),
          ...JSON.parse(decodeURIComponent(escape(atob(seed[1].replace(/-/g, '+').replace(/_/g, '/'))))),
          name: code,
          updatedAt: Date.now(),
        };
      } catch {}
      await apiPut(id, data);
      history.replaceState(null, '', location.pathname);
    }
    await openGroup(code, id);
    // evento recém-criado já abre na lista de gente; fechou, cai na nota pedindo o "quem é você?"
    if (criou && !state.people.length) showSetup();
  }
  async function openGroup(code, id) {
    // o código fica no endereço: copiar a URL da barra já manda o evento
    // (sem o &quem=: a barra copiada não pode mandar o próximo entrar como outra pessoa)
    if (code && location.search !== '?evento=' + encodeURIComponent(code))
      history.replaceState(null, '', location.pathname + '?evento=' + encodeURIComponent(code) + location.hash);
    roomName = code;
    groupId = id;
    if (code)
      mexe(roomKey(id), (o) => {
        o.code = code;
        o.openedAt = Date.now();
        delete o.hidden;
      }); // entrou de novo, volta pra lista
    {
      const r = room();
      me = typeof r.me === 'string' ? r.me : null;
      lastSeen = +r.lastSeen || 0;
    }
    meusIds = new Set(
      meusEventos()
        .filter((e) => e.id !== id && e.me)
        .map((e) => /** @type {string} */ (e.me)),
    );
    showAll = false;
    showGone = false;
    $('#app').classList.add('loading');
    $('#app').classList.remove('nospin');
    state = cacheLoad();
    if (state) render();
    closeOverlay();
    setStatus('Carregando…');
    pixKeys = {};
    pixReady = false;
    rearmaAnims();
    try {
      const remote = await apiGet(groupId);
      state = merge(state, remote);
      if (!state.name && code) {
        state.name = code;
        state.updatedAt = Date.now();
        apiPut(groupId, state).catch(() => {});
      }
      cacheSave();
      render();
      setStatus('Sincronizado');
    } catch (e) {
      if (e.notFound) return showLost();
      if (!state) {
        state = fresh(code);
        render();
      }
      setStatus('Offline · ' + e.message, true);
    }
    $('#app').classList.remove('loading');
    // o link veio com &quem=: o aparelho que ainda não é ninguém no evento já entra como essa pessoa
    const quem = quemDoLink;
    quemDoLink = null;
    if (!me && quem && state.people.some((p) => p.id === quem)) souEu(quem);
    // ninguém é interrompido na chegada: a tela de estreia e o "quem é você?"
    // esperam o toque no botão do cabeçalho
    startPolling();
    sync();
    loadPixKeys();
  }
  function showQuitado(to, cents, parcial = false) {
    overlay(`<h2>${parcial ? 'Pago!' : 'Quitado!'}</h2>
      <p class="muted recado" style="margin-bottom:14px">avise ${nomeHtml(to)} pra não cobrar de novo</p>
      <button id="waAviso" class="big">${WA_SVG} avisar no zap</button>
      <div class="c voltar"><button id="quitOk" class="ghost">fechar</button></div>`);
    const fecha = () => {
      closeOverlay();
      seguraRisco = false;
      render();
    }; // solta o risco da linha nova
    $('#quitOk').onclick = fecha;
    overlayCancel = fecha;
    $('#waAviso').onclick = () => {
      abreZap(
        `✅ ${nameOf(to)}, te paguei ${comSifrao(cents)} do *${evento()}* 👍\n${shareUrl('', 'pago')}`,
        zapDe(to) || '',
      );
      fecha();
    };
  }
  /** o endereço sem código é a lista de eventos (ou o cartão do código, pra quem nunca entrou em nenhum) */
  function leave() {
    location.href = location.pathname;
  }

  // #endregion
  // #region meus eventos
  // ---------- meus eventos (só deste aparelho: o banco não deixa listar nada) ----------
  /** @typedef {{ id: string, code: string, nome: string, at: number, me: string|null, snap: Room|null }} MeuEvento */
  /** os eventos que este aparelho já abriu, do último aberto pro mais antigo @returns {MeuEvento[]} */
  function meusEventos() {
    let ks = [];
    try {
      ks = Object.keys(localStorage);
    } catch {}
    return ks
      .filter((k) => k.startsWith(DEVICE + ':'))
      .map((k) => k.slice(DEVICE.length + 1))
      .filter((id) => /^[0-9a-f]{64}$/.test(id))
      .map((id) => ({ id, o: gaveta(roomKey(id)) }))
      .filter(({ o }) => typeof o.code === 'string' && o.code && o.code.length <= 100 && !o.hidden)
      .map(({ id, o }) => {
        const snap = clean(o.snapshot);
        return {
          id,
          code: o.code,
          nome: (snap && snap.name) || o.code,
          // a data e a ordem são da última mudança no evento (gasto, pagamento, gente), não de quando
          // foi aberto: só olhar não sobe o evento na lista
          at: Math.max((snap && snap.updatedAt) || 0, +o.changedAt || 0) || +o.openedAt || 0,
          me: okId(o.me) ? o.me : null,
          snap,
        };
      })
      .sort((a, b) => b.at - a.at);
  }
  /** esquecer só esconde: apagar a gaveta levaria junto o tok do pix, e a chave travava */
  const esconde = (id) =>
    mexe(roomKey(id), (o) => {
      o.hidden = true;
    });
  /** as gavetas dos eventos, inclusive as esquecidas (o ✕ só esconde) */
  const gavetasDeEvento = () => {
    try {
      return Object.keys(localStorage).filter((k) => k.startsWith(DEVICE + ':'));
    } catch {
      return [];
    }
  };
  /** tem o que apagar: algum evento, ou o nome e a chave pix lembrados pro próximo */
  const temDados = () => gavetasDeEvento().length > 0 || !!device().myName || !!device().pixKey;
  /** celular emprestado, vendido ou de casal: tira a minha chave pix de cada evento (com o tok, que só este
   * aparelho tem, e por isso antes de tudo), desliga os avisos e apaga as gavetas. Sem rede, as chaves ficam */
  async function apagaTudo() {
    const semRede = navigator.onLine === false;
    const ok = await ask(
      'Apagar meus dados deste aparelho?',
      `tira a sua chave pix de cada evento e apaga daqui os eventos, o seu nome e os avisos. os eventos continuam pra turma, pelo link.${
        semRede
          ? '<br><br>sem internet: as chaves pix ficam nos eventos, e o segredo delas fica aqui até você apagar de novo com internet.'
          : ''
      }`,
      'apagar tudo',
      true,
    );
    if (!ok) return showGate();
    overlay('<h2>Apagando…</h2>', true);
    apagando = true;
    clearInterval(pollTimer);
    const gavetas = gavetasDeEvento();
    /** @type {Promise<unknown>[]} */ const feito = [];
    /** o tok que o banco não confirmou fica: a chave pode estar lá ainda, e sem ele ninguém tira mais
     *  @type {Record<string, Record<string, string>>} */ const ficam = {};
    let sub = null;
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      sub = reg ? await reg.pushManager.getSubscription() : null;
    } catch {}
    for (const k of gavetas) {
      const sala = k.slice(DEVICE.length + 1),
        o = gaveta(k);
      if (!/^[0-9a-f]{64}$/.test(sala)) continue;
      // a chave vazia com o tok solta o nó: qualquer aparelho cadastra de novo
      if (o.pixTokens && typeof o.pixTokens === 'object')
        for (const [pid, tok] of Object.entries(o.pixTokens))
          if (okId(pid) && typeof tok === 'string' && tok)
            feito.push(
              gravaPix(sala, pid, '', tok)
                // 401/403: a chave já não é deste aparelho, o tok não serve mais pra nada
                .then((r) => r.ok || r.status === 401 || r.status === 403)
                .catch(() => false)
                .then((saiu) => {
                  if (!saiu) (ficam[k] ||= {})[pid] = tok;
                }),
            );
      if (sub && okId(o.pushOn) && typeof o.pushTok === 'string')
        feito.push(
          postaApi('/desinscreve', { sala, pessoa: o.pushOn, endpoint: sub.endpoint, tok: o.pushTok }).catch(() => {}),
        );
    }
    await Promise.all(feito);
    if (sub) await sub.unsubscribe().catch(() => {});
    await new Promise((fim) => {
      try {
        const r = indexedDB.deleteDatabase('tolisa');
        r.onsuccess = r.onerror = r.onblocked = fim;
      } catch {
        fim(null);
      }
    });
    if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
    /** @type {string[]} */ const falhou = [];
    for (const k of gavetas) {
      if (!ficam[k]) {
        ls.del(k);
        continue;
      }
      // fica só o tok (e o código, pro aviso), esquecida: o "apagar meus dados" segue na tela pra tentar de novo
      const code = gaveta(k).code,
        nome = typeof code === 'string' && code && code.length <= 100 ? code : 'um evento';
      falhou.push(nome);
      ls.set(k, JSON.stringify({ code, hidden: true, pixTokens: ficam[k] }));
    }
    ls.del(DEVICE);
    if (falhou.length)
      await ask(
        'Faltou a chave pix',
        `não deu pra tirar a chave de ${falhou.map((n) => `<b>${esc(n)}</b>`).join(', ')}, tenta de novo com internet. o resto já saiu daqui.`,
        'ok',
      );
    location.replace(location.pathname);
  }
  /** dias de calendário de `at` até hoje (ontem é 1, mesmo que tenha sido há 2 horas) */
  function diasDesde(at) {
    const dia = (t) => new Date(new Date(t).toDateString()).getTime();
    return Math.round((dia(Date.now()) - dia(at)) / 86400000);
  }
  function quando(at) {
    if (!at) return '';
    const d = new Date(at),
      hoje = new Date(),
      dias = diasDesde(at);
    if (Date.now() - at < 3600000) return 'agora';
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    if (dias < 7) return `há ${dias} dias`;
    if (dias < 35) return `há ${Math.round(dias / 7)} semana${Math.round(dias / 7) === 1 ? '' : 's'}`;
    const mes = d.toLocaleDateString('pt-BR', { month: 'long' });
    return d.getFullYear() === hoje.getFullYear() ? `em ${mes}` : `em ${mes} de ${d.getFullYear()}`;
  }
  /** a cópia do aparelho só sabe o que ele viu: a lista pergunta ao banco o updatedAt de cada evento
   * (um número por evento, nada de listar). O que mudou em outro aparelho vem inteiro (só esse evento)
   * e entra na cópia, senão o saldo da lista fica velho; aí redesenha a lista no lugar */
  function atualizaDatas(evs, comX, esquece) {
    let mudou = false;
    Promise.all(
      evs.map(async (e) => {
        try {
          const r = await noBanco(`${DB}/rooms/${e.id}/updatedAt.json`, { cache: 'no-store' });
          const v = r.ok ? await r.json() : null;
          if (typeof v !== 'number' || !(v > e.at) || v > Date.now() + 86400000) return;
          mexe(roomKey(e.id), (o) => {
            o.changedAt = v;
          });
          mudou = true;
          const rr = await noBanco(`${DB}/rooms/${e.id}.json`, { cache: 'no-store' });
          const remoto = rr.ok ? clean(await rr.json()) : null;
          // merge e não troca: a cópia pode ter algo anotado sem internet que o banco ainda não viu
          if (remoto)
            mexe(roomKey(e.id), (o) => {
              o.snapshot = merge(o.snapshot, remoto);
            });
        } catch {}
      }),
    ).then(() => {
      if (mudou) atualizaBolinha();
      const caixa = $('#overlayBox .evs');
      if (!mudou || !caixa) return;
      const novos = meusEventos(),
        aberto = !!caixa.querySelector('details.antigos[open]');
      caixa.outerHTML = listaEventos(novos, comX);
      if (aberto) $('#overlayBox details.antigos')?.setAttribute('open', '');
      ligaEventos(novos, esquece);
    });
  }
  // a ampulheta do evento parado, em pixel como o resto (o emoji destoava): 5×7, areia no tom fraco
  const AMPULHETA =
    '<svg class="ampulheta" viewBox="0 0 5 7" width="10" height="14" shape-rendering="crispEdges" role="img" aria-label="parado"><path fill="currentColor" d="M0 0h5v1H0zM0 1h1v1H0zM4 1h1v1H4zM1 2h1v1H1zM3 2h1v1H3zM2 3h1v1H2zM1 4h1v1H1zM3 4h1v1H3zM0 5h1v1H0zM4 5h1v1H4zM0 6h5v1H0z"/><path fill="var(--ink2)" d="M2 5h1v1H2z"/></svg>';
  /** cada evento com o meu saldo nele, contado da cópia do aparelho: abre sem internet.
   * Em cima, a soma dos saldos (com dois eventos ou mais, e se não der zero); no evento parado
   * em que me devem, "parado há N dias" no lugar da data; os quites antigos, recolhidos no fim */
  function listaEventos(evs, comX) {
    /** @param {MeuEvento} e @returns {number|null} */
    const saldo = (e) => {
      const eu = e.snap && e.me ? e.snap.people.find((p) => p.id === e.me) : null;
      return eu ? balances(e.snap)[eu.id] || 0 : null;
    };
    const saldos = evs.map(saldo).filter((b) => b !== null),
      total = saldos.reduce((a, b) => a + b, 0);
    const topo =
      saldos.length > 1 && total
        ? `<div class="evtotal">no total: <b class="${total > 0 ? 'pos' : 'neg'}">${total > 0 ? 'te devem' : 'você deve'} ${comSifrao(total)}</b></div>`
        : '';
    /** @param {MeuEvento} e */
    const cartao = (e) => {
      const s = e.snap,
        eu = s && e.me ? s.people.find((p) => p.id === e.me) : null,
        b = saldo(e),
        dias = e.at ? diasDesde(e.at) : 0;
      let cls = 'ok',
        v = '—';
      if (b > 0) [cls, v] = ['pos', comSifrao(b)];
      else if (b < 0) [cls, v] = ['neg', comSifrao(b)];
      else if (b === 0) v = 'quite';
      const n = s ? s.people.length : 0,
        sub = [eu ? `sou ${esc(eu.name)}` : '', n ? `${n} pessoa${n === 1 ? '' : 's'}` : '']
          .filter(Boolean)
          .join(' · ');
      // parado e me devem: no lugar da data, há quanto tempo ninguém mexe (o valor já está em cima)
      const data =
        b > 0 && dias >= PARADO_DIAS
          ? `<span class="parado">${AMPULHETA}há ${dias} dias</span>`
          : `<span>${quando(e.at)}</span>`;
      return `<div class="ev${e.id === groupId ? ' aqui' : ''}" data-ev="${e.id}" role="button" tabindex="0">
        <div class="row"><span class="l">${esc(e.nome)}</span><span class="d"></span><span class="v ${cls}">${v}</span>${comX ? `<button class="ico x" data-esquece="${e.id}" title="esquecer" aria-label="esquecer o evento ${esc(e.nome)}">✕</button>` : ''}</div>
        <div class="sub"><span>${sub}</span>${data}</div></div>`;
    };
    // quite e parado há tempo desce pro fim, recolhido como os itens apagados; o evento aberto fica sempre à vista
    const antigo = (e) => e.id !== groupId && saldo(e) === 0 && e.at && diasDesde(e.at) >= QUITADO_DIAS;
    const antigos = evs.filter(antigo);
    return `<div class="evs">${topo}${evs
      .filter((e) => !antigo(e))
      .map(cartao)
      .join('')}${
      antigos.length
        ? `<details class="antigos"><summary>${antigos.length} ${antigos.length === 1 ? 'quitado antigo' : 'quitados antigos'}</summary>${antigos.map(cartao).join('')}</details>`
        : ''
    }</div>`;
  }
  /** o ✕ da lista, no cartão do evento e na tela inicial: pergunta, tira só deste aparelho e volta pro
   * cartão de onde veio (esquecer o evento aberto é sair dele) @param {MeuEvento} e @param {() => void} volta */
  async function esqueceEvento(e, volta) {
    if (
      await ask(`Esquecer ${esc(e.nome)}?`, 'some da lista só neste aparelho. você volta pelo link.', 'esquecer', true)
    ) {
      esconde(e.id);
      atualizaBolinha();
      if (e.id === groupId) return leave();
    }
    volta();
  }
  /** a linha inteira abre o evento; o ✕ dela chama `esquece` @param {MeuEvento[]} evs @param {(e: MeuEvento) => void} [esquece] */
  function ligaEventos(evs, esquece) {
    const abre = (e) => {
      if (e.id === groupId) return closeOverlay();
      location.href = location.pathname + '?evento=' + encodeURIComponent(e.code);
    };
    for (const el of inputs('#overlayBox [data-ev]')) {
      const e = evs.find((x) => x.id === el.dataset.ev);
      if (!e) continue;
      el.onclick = (ev) => {
        const x = /** @type {Element} */ (ev.target).closest('[data-esquece]');
        if (x) {
          if (esquece) esquece(e);
          return;
        }
        abre(e);
      };
      el.onkeydown = (ev) => {
        if (ev.target === el && (ev.key === 'Enter' || ev.key === ' ')) {
          ev.preventDefault();
          abre(e);
        }
      };
    }
  }

  /** a bolinha no ícone do app instalado: quantas linhas do acerto são minhas (devo ou recebo), somando os
   * eventos do aparelho. Só o número, nunca valor. Vai pro IndexedDB por evento, que o sw.js refaz o do
   * evento quando chega o push de pagamento. Navegador sem bolinha: nada */
  let bolinhaAntes = '';
  function atualizaBolinha() {
    if (!('setAppBadge' in navigator)) return;
    /** @type {Record<string, number>} */ const n = {},
      /** @type {Record<string, string>} */ quem = {};
    for (const e of meusEventos()) {
      const aqui = e.id === groupId && state,
        s = aqui ? state : e.snap,
        eu = aqui ? me : e.me;
      if (!s || !eu) continue;
      n[e.id] = settlements(balances(s)).filter((t) => t.from === eu || t.to === eu).length;
      quem[e.id] = eu;
    }
    const k = JSON.stringify([n, quem]);
    if (k === bolinhaAntes) return;
    bolinhaAntes = k;
    const total = Object.values(n).reduce((a, b) => a + b, 0);
    (total ? navigator.setAppBadge(total) : navigator.clearAppBadge()).catch(() => {});
    avisosDb('readwrite', (st) => st.put({ sala: 'bolinha', n, eu: quem })).catch(() => {});
  }

  // #endregion
  // #region a digital
  // ---------- a digital (passkey, #168) ----------
  // protótipo atrás do DIGITAL. "guardar com a digital" cria uma passkey e manda pra API (servidor/src/digital.js)
  // a lista dos meus eventos, com quem sou eu em cada um; noutro aparelho, ou com o navegador limpo, "entrar com
  // a digital" assina o desafio da API e a lista volta pro Meus eventos. A passkey é das que o celular lembra
  // sozinho (resident key): entrar não pede nome nenhum. O rpId é o domínio do site (localhost na máquina).
  // TODO(#168): o tok do pix fica de fora, porque no servidor ele vira desvio de pagamento. Próxima fatia: cifrar
  // o tok com a extensão PRF da passkey e a API guardar só o cifrado
  (() => {
    const q = new URLSearchParams(location.search);
    if (q.has('digital')) setDevice('passkeyOn', q.get('digital') === '0' ? undefined : true);
  })();
  const temDigital = () =>
    (DIGITAL || device().passkeyOn === true) && 'PublicKeyCredential' in window && !!navigator.credentials;
  /** os bytes em base64url, sem o = do fim (o jeito do WebAuthn) @param {ArrayBuffer} buf */
  const b64De = (buf) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  /** a linha do cartão de Meus eventos: guardar só aparece com evento pra guardar */
  const linhaDigital = (temEventos) =>
    temDigital()
      ? `<div class="c digital">${temEventos ? '<a class="link" id="digGuarda">guardar com a digital</a> · ' : ''}<a class="link" id="digEntra">entrar com a digital</a></div>`
      : '';
  function ligaDigital() {
    const g = $('#digGuarda'),
      e = $('#digEntra');
    if (g) g.onclick = guardaDigital;
    if (e) e.onclick = entraDigital;
  }
  /** o desafio vale uma vez e por pouco tempo: um pra cada toque */
  async function desafioDigital() {
    const r = await postaApi('/digital/desafio', {});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return bytesDe((await r.json()).desafio);
  }
  /** o que a passkey assinou, do jeito que a API confere @param {Credential | null} c */
  const assinado = (c) => {
    const p = /** @type {PublicKeyCredential} */ (c),
      r = /** @type {AuthenticatorAssertionResponse} */ (p.response);
    return {
      id: p.id,
      dados: b64De(r.clientDataJSON),
      autenticador: b64De(r.authenticatorData),
      assinatura: b64De(r.signature),
    };
  };
  /** cancelou a digital (ou o tempo dela acabou): não é erro, é desistência */
  const desistiu = (e) => e && (e.name === 'NotAllowedError' || e.name === 'AbortError');
  let mexendoDigital = false;
  async function guardaDigital() {
    if (mexendoDigital) return;
    mexendoDigital = true;
    const eventos = meusEventos().map((e) => ({ code: e.code, me: e.me }));
    try {
      const rpId = location.hostname,
        challenge = await desafioDigital(),
        ja = device().passkeyId;
      /** @type {Record<string, any>} */ let corpo;
      if (typeof ja === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(ja))
        // este aparelho já guardou: a mesma passkey assina, e a lista nova se junta à de lá
        corpo = assinado(
          await navigator.credentials.get({
            publicKey: {
              challenge,
              rpId,
              allowCredentials: [{ type: 'public-key', id: bytesDe(ja) }],
              userVerification: 'required',
            },
          }),
        );
      else {
        const nome = typeof device().myName === 'string' && device().myName ? device().myName : 'eu',
          c = /** @type {PublicKeyCredential} */ (
            await navigator.credentials.create({
              publicKey: {
                challenge,
                rp: { id: rpId, name: 'tô lisa' },
                user: { id: crypto.getRandomValues(new Uint8Array(16)), name: nome, displayName: nome },
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
                authenticatorSelection: {
                  residentKey: 'required',
                  requireResidentKey: true,
                  userVerification: 'required',
                },
                attestation: 'none',
              },
            })
          ),
          r = /** @type {AuthenticatorAttestationResponse} */ (c.response),
          chave = r.getPublicKey();
        if (!chave || r.getPublicKeyAlgorithm() !== -7) return toast('Essa digital não serve aqui');
        corpo = {
          id: c.id,
          chave: b64De(chave),
          alg: -7,
          dados: b64De(r.clientDataJSON),
          autenticador: b64De(r.getAuthenticatorData()),
        };
      }
      const resp = await postaApi('/digital/guarda', { ...corpo, eventos });
      if (resp.status === 404) {
        setDevice('passkeyId', undefined);
        return toast('Essa digital se perdeu. Toca de novo que eu guardo numa nova.');
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setDevice('passkeyId', corpo.id);
      toast(
        `Guardei ${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'} na digital. Noutro celular, é só entrar com ela.`,
      );
    } catch (e) {
      toast(desistiu(e) ? 'Ficou pra depois' : 'Não deu pra guardar agora');
    } finally {
      mexendoDigital = false;
    }
  }
  async function entraDigital() {
    if (mexendoDigital) return;
    mexendoDigital = true;
    try {
      // sem allowCredentials: o celular mostra as passkeys do tô lisa que ele tem, sem perguntar nome
      const corpo = assinado(
        await navigator.credentials.get({
          publicKey: { challenge: await desafioDigital(), rpId: location.hostname, userVerification: 'required' },
        }),
      );
      const r = await postaApi('/digital/entra', corpo);
      if (r.status === 404) return toast('Essa digital não tem evento guardado');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const n = await restauraEventos((await r.json()).eventos);
      setDevice('passkeyId', corpo.id);
      showGate();
      toast(n ? `${n === 1 ? 'Voltou 1 evento' : `Voltaram ${n} eventos`} 🫰` : 'Essa digital não tem evento guardado');
    } catch (e) {
      toast(desistiu(e) ? 'Ficou pra depois' : 'Não deu pra entrar agora');
    } finally {
      mexendoDigital = false;
    }
  }
  /** a lista da API volta pras gavetas: código, quem sou eu (se o aparelho não sabia) e a cópia do evento, do
   * banco, pro nome e o saldo aparecerem já na lista. O que veio da API passa pelo mesmo crivo do resto */
  async function restauraEventos(lista) {
    const ok = (Array.isArray(lista) ? lista : []).filter(
      (e) => e && typeof e.code === 'string' && e.code.trim() && e.code.length <= 100,
    );
    await Promise.all(
      ok.map(async (e) => {
        const code = e.code.trim().toLowerCase(),
          id = await sha(code);
        mexe(roomKey(id), (o) => {
          o.code = code;
          delete o.hidden;
          if (!okId(o.me) && okId(e.me)) o.me = e.me;
          o.openedAt ??= Date.now();
        });
        try {
          const r = await noBanco(`${DB}/rooms/${id}.json`, { cache: 'no-store' }),
            remoto = r.ok ? clean(await r.json()) : null;
          if (remoto)
            mexe(roomKey(id), (o) => {
              o.snapshot = merge(o.snapshot, remoto);
            });
        } catch {}
      }),
    );
    atualizaBolinha();
    return ok.length;
  }

  // #endregion
  // #region botões
  // ---------- botões ----------
  $('#toggleAll').onclick = () => {
    showAll = !showAll;
    render();
  };
  $('#itemsHead').onclick = () => {
    itemsOpen = !itemsOpen;
    if (itemsOpen) setDevice('itemsOpened', true);
    render();
  };
  // é um botão pra quem usa teclado também: Enter e Espaço abrem como o clique
  $('#itemsHead').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      $('#itemsHead').click();
    }
  });
  /** @type {HTMLElement | null} */
  let sheetDeQuem = null;
  const openSheet = () => {
    if ($('#sheet').classList.contains('hidden'))
      sheetDeQuem = /** @type {HTMLElement | null} */ (document.activeElement);
    $('#sheet').classList.remove('hidden');
    $('#amount').focus();
  };
  const limpaForm = () => {
    editando = null;
    $('#desc').value = '';
    $('#amount').value = '';
    splitMode = 'equal';
    $('#splitChips').innerHTML = '';
    $('#sharesBox').innerHTML = '';
    delete $('#sharesBox').dataset.k;
    $('#sheet h2').textContent = 'Anotar';
    $('#expenseForm button.big').textContent = 'Anotar';
  };
  // fechar no meio de uma edição joga ela fora: o próximo anotar começa limpo
  const closeSheet = () => {
    $('#sheet').classList.add('hidden');
    if (editando) {
      limpaForm();
      render();
    }
    const de = sheetDeQuem;
    sheetDeQuem = null;
    voltaFoco(de);
  };
  /** o anotar abre com o item preenchido; salvar troca ele por um novo no mesmo lugar */
  function editaItem(e) {
    limpaForm();
    editando = e.id;
    render();
    $('#amount').value = reais(centavos(e));
    $('#desc').value = e.desc;
    $('#payer').value = e.payer;
    for (const c of inputs('#splitChips input')) {
      c.checked = e.among.includes(c.value);
      c.closest('.chip').classList.toggle('on', c.checked);
    }
    // o igual com o centavo girado também tem `shares`, mas volta na aba igual
    const partes = !ehIgual(e);
    splitMode = partes ? 'custom' : 'equal';
    updateHint();
    if (partes) {
      for (const i of inputs('#sharesBox input[data-share]')) i.value = reais(e.shares[i.dataset.share] || 0);
      atualizaFalta();
    }
    $('#sheet h2').textContent = 'Editar';
    $('#expenseForm button.big').textContent = 'Salvar';
    openSheet();
  }
  /** o item sai da conta e fica riscado na lista com quem apagou; `to` é quem tomou o lugar dele */
  const apagaItem = (e, to) => {
    state.expenses = state.expenses.filter((x) => x.id !== e.id);
    state.deleted.push(e.id);
    state.gone.push({
      id: e.id,
      desc: e.desc,
      amount: e.amount,
      at: e.at,
      by: me ? nameOf(me) : '',
      ...(me ? { byId: me } : {}),
      goneAt: Date.now(),
      ...(to ? { to } : {}),
    });
  };
  // a nota subindo passa por baixo do ✎ e do zap: cada um fica meio transparente quando
  // o texto chega nele, não os dois de uma vez. O de baixo é alcançado primeiro. A régua é
  // o tracejado do cabeçalho, onde a nota começa a correr por baixo deles
  const vaza = () => {
    const corte = /** @type {HTMLElement} */ ($('#app > .hr')).getBoundingClientRect().top;
    for (const b of [$('#fab'), $('#waBtn')]) {
      const r = b.getBoundingClientRect();
      b.classList.toggle('vaza', r.height > 0 && corte < r.bottom);
    }
  };
  addEventListener('scroll', vaza, { passive: true });
  addEventListener('resize', vaza);
  new ResizeObserver(vaza).observe($('#app'));
  $('#fab').onclick = () => {
    setDevice('fabTaps', (+device().fabTaps || 0) + 1);
    if (!state.people.length) return toast('Põe a galera primeiro');
    openSheet();
    convidaInstalar();
  };
  $('#sheetClose').onclick = closeSheet;
  // Esc fecha o que tá por cima: o cartão primeiro, depois o anotar
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || ev.defaultPrevented) return;
    if (!semCartao()) fechaPorFora();
    else if (!$('#sheet').classList.contains('hidden')) closeSheet();
    else return;
    ev.preventDefault();
  });
  $('#sheet').addEventListener('click', (ev) => {
    if (ev.target.id === 'sheet') closeSheet();
  });
  /** o gasto que parece o mesmo: mesmo valor e mesmo pagante, anotado há pouco. No rolê, quem pagou
   *  e quem tava com o celular na mão anotam o mesmo Uber @param {Expense} exp */
  const jaAnotado = (exp) =>
    state.expenses
      .filter(
        (x) =>
          !x.kind && x.payer === exp.payer && centavos(x) === centavos(exp) && exp.at - x.at < JA_ANOTADO_H * 3600000,
      )
      .pop();
  /** "há 3 min", pro cartão do já anotado */
  const ha = (at) => {
    const min = Math.round((Date.now() - at) / 60000);
    return min < 1 ? 'agora' : min < 60 ? `há ${min} min` : `há ${Math.round(min / 60)} h`;
  };
  let conferindo = false; // o anotar espera o banco: o segundo toque no botão não anota de novo
  $('#expenseForm').onsubmit = async (ev) => {
    ev.preventDefault();
    if (conferindo) return;
    const among = inputs('#splitChips input:checked').map((i) => i.value);
    const total = lerCentavos($('#amount').value);
    if (!state.people.length) return toast('Põe a galera primeiro');
    if (!among.length) return toast('Marque quem divide esse gasto');
    if (among.length > RACHA_MAX) return toast(`Dá pra dividir entre até ${RACHA_MAX} pessoas`);
    if (!(total > 0)) return toast('Põe quanto foi');
    const exp = {
      id: uid(),
      desc: $('#desc').value.trim(),
      amount: total / 100,
      payer: $('#payer').value,
      among,
      at: Date.now(),
      by: me ? nameOf(me) : undefined,
      byId: me || undefined,
    };
    if (splitMode === 'custom') {
      const sh = customShares();
      const sum = among.reduce((a, id) => a + (sh[id] || 0), 0);
      if (sum !== total)
        return toast(
          sum < total ? `Faltam ${comSifrao(total - sum)} nas partes` : `Sobram ${comSifrao(sum - total)} nas partes`,
        );
      exp.shares = {};
      for (const id of among) exp.shares[id] = sh[id] || 0;
    }
    const velho = editando && state.expenses.find((x) => x.id === editando);
    if (splitMode !== 'custom' && total % among.length) {
      // editou só a descrição (ou o pagante): o centavo fica com quem já estava
      const igual = velho && ehIgual(velho) && centavos(velho) === total && velho.among.join() === among.join();
      if (igual) {
        if (velho.shares) exp.shares = { ...velho.shares };
      } else exp.shares = sharesGirando(total, among, velho ? state.expenses.indexOf(velho) : state.expenses.length);
    }
    // edição não pergunta. Antes de perguntar, o banco: o outro aparelho pode ter acabado de anotar
    if (!editando) {
      // o banco tem prazo: com a rede engasgada, confere com o que já chegou e anota (o sync mescla depois)
      const botao = /** @type {HTMLButtonElement} */ ($('#expenseForm button.big'));
      conferindo = true;
      botao.disabled = true;
      botao.textContent = 'conferindo…';
      await Promise.race([sync(), new Promise((r) => setTimeout(r, 1500))]);
      conferindo = false;
      botao.disabled = false;
      botao.textContent = 'Anotar';
      if ($('#sheet').classList.contains('hidden')) return; // fechou o anotar enquanto conferia: desistiu
      const ja = jaAnotado(exp);
      if (ja) {
        const autor = autorNome(ja) ? `, anotado por ${autorHtml(ja)}` : '';
        const desc = ja.desc ? `${esc(ja.desc)} · ` : '';
        const mesmo = await ask(
          'Já anotaram?',
          `${desc}${comSifrao(centavos(ja))} · ${nomeHtml(ja.payer)} pagou${autor} ${ha(ja.at)}`,
          'anotar mesmo assim',
        );
        if (!mesmo) return;
      }
      exp.at = Date.now();
    }
    if (velho) {
      exp.at = velho.at;
      apagaItem(velho, exp.id);
    }
    state.expenses.push(exp);
    state.expenses.sort((x, y) => x.at - y.at);
    limpaForm();
    itemsOpen = true;
    closeSheet();
    commit();
    toast(velho ? 'Editado!' : 'Anotado!');
  };
  $('#payer').onchange = updateHint;
  // o dedo não tem hover: o toque no ✔ e no copiar pix preenche o botão e volta.
  // Na captura, pra pegar o toque mesmo que alguém pare o evento no caminho
  document.addEventListener(
    'pointerdown',
    (ev) => {
      if (ev.pointerType === 'mouse') return; // no mouse quem responde é o hover
      const b = /** @type {HTMLElement|null} */ (
        /** @type {HTMLElement} */ (ev.target).closest('#mineRows .dupla > button.ico')
      );
      if (!b) return;
      anim.tocouOk = true;
      b.classList.remove('pisca');
      // a piscada é montada com `animation-delay` inline, e declaração inline vence a
      // folha: sem tirar o atraso, o toque nascia adiantado (a piscada correndo) ou
      // parado no primeiro quadro pelo tempo do atraso que sobrou
      b.style.removeProperty('animation-delay');
      b.classList.remove('brota');
      // tocar de novo antes da anterior acabar recomeça a animação
      b.classList.remove('tocou');
      void b.offsetWidth;
      b.classList.add('tocou');
      b.addEventListener('animationend', () => b.classList.remove('tocou'), { once: true });
    },
    true,
  );
  // #endregion
  // #region cliques
  // ---------- cliques ----------
  // cada botão diz o que é num data-* (ou num id), e esta lista diz o que cada um faz.
  // Um clique só no document atende a página toda, inclusive o que o render() refaz.
  const achaGasto = (id) => state.expenses.find((x) => x.id === id);
  /** copia pro clipboard; sem permissão, mostra o texto num cartão pra copiar na mão
   * (ou onde `naMao` mandar, quando o cartão aberto não pode sumir) */
  const copia = (texto, recado, titulo, naMao = () => showCopy(titulo, texto)) =>
    navigator.clipboard.writeText(texto).then(() => toast(recado), naMao);
  /** abre ou fecha os detalhes de um item (quem pagou, como dividiu, editar) */
  const abreItem = (it) => {
    const id = it.dataset.item;
    openItems.has(id) ? openItems.delete(id) : openItems.add(id);
    it.classList.toggle('open');
  };
  function copiaPix(el) {
    const [to, cents] = el.dataset.pix.split('|');
    const texto = pixCode(pixKeys[to], nameOf(to), +cents);
    // no Quitar? o cartão fica aberto: sem clipboard, o código aparece ali embaixo do botão
    const noQuitar = el.id === 'quitaPix' ? () => el.insertAdjacentHTML('afterend', pixNaMao(texto)) : undefined;
    copia(texto, 'Pix copia e cola copiado. Cola no app do banco.', 'Pix copia e cola', noQuitar);
  }
  const pixNaMao = (texto) => {
    $('#quitaPixCode')?.remove();
    return `<code id="quitaPixCode" class="box">${esc(texto)}</code>`;
  };
  // desfazer é escondido: três toques seguidos no carimbo. Guarda o id, não o elemento,
  // porque o render do sync troca o carimbo no meio dos toques
  let toques = { id: '', n: 0, at: 0 };
  function tocaCarimbo(el) {
    const agora = Date.now();
    if (toques.id !== el.dataset.undo || agora - toques.at > 600) toques = { id: el.dataset.undo, n: 0, at: 0 };
    toques.n++;
    toques.at = agora;
    if (toques.n < 3) return;
    toques = { id: '', n: 0, at: 0 };
    desfazPagamento(el);
  }
  async function desfazPagamento(el) {
    const e = achaGasto(el.dataset.undo);
    if (!e) return;
    const certeza = await ask(
      e.forgiven ? 'Desfazer o perdão?' : 'Desfazer o pagamento?',
      `${nomeHtml(e.payer)} → ${nomeHtml(e.among[0])} · ${comSifrao(centavos(e))}`,
      'desfazer',
    );
    if (!certeza) return;
    // não é apagaItem(): pagamento desfeito não vai pra lista de itens apagados
    state.expenses = state.expenses.filter((x) => x.id !== e.id);
    state.deleted.push(e.id);
    anim.riscos.delete(e.id);
    commit();
    toast('Desfeito');
  }
  /** o ✔ paguei de quem deve, e o ✔ recebi e o perdoar de quem recebe: todos viram um
   *  gasto do tipo 'payment' de quem deve pra quem recebe; o perdão leva `forgiven` */
  async function quita(el) {
    const modo = el.dataset.perdoa ? 'perdoa' : el.dataset.recebi ? 'recebi' : 'paguei';
    const [from, to, cs] = (el.dataset.perdoa || el.dataset.recebi || el.dataset.settle).split('|');
    let cents = +cs;
    // o confete sai do botão: mede antes do cartão abrir por cima
    const r = el.getBoundingClientRect();
    const valor = `<b style="color:var(--green)">${comSifrao(cents)}</b>`;
    // quem paga escolhe quanto: "te mando 50 agora e o resto sexta". Vem com o total, na máscara do anotar
    // quitar é pagar tudo: com menos que o total, o cartão vira "pagar"
    const total = cents;
    // com a chave de quem recebe, o pix sai do próprio cartão com o valor digitado (a linha copia o total)
    const pergunta = () => {
      const pix =
        pixReady && pixKeys[to]
          ? `<button id="quitaPix" class="ico" data-pix="${to}|${cents}">${PIX_SVG} copiar pix de <span>${comSifrao(cents)}</span></button>`
          : '';
      const p = ask(
        'Quitar?',
        `${nomeHtml(from)} pagou <b id="quitaFrase" style="color:var(--green)">${comSifrao(cents)}</b> pra ${nomeHtml(to)}<label class="quitaValor">${CURRENCY}<input id="quitaValor" type="text" inputmode="numeric" enterkeyhint="done" autocomplete="off" placeholder="0,00" value="${reais(cents)}" aria-label="quanto pagou"></label>${pix}`,
        'quitei',
      );
      const cx = /** @type {HTMLInputElement} */ ($('#quitaValor'));
      // o sublinhado é da linha toda (R$ + valor): a caixa cresce com o que tem dentro, e fica tudo no meio
      const ajusta = () => {
        cx.style.width = Math.max(cx.value.length, 4) + 'ch';
        const parte = cents > 0 && cents < total;
        $('#overlayBox h2').textContent = parte ? 'Pagar?' : 'Quitar?';
        $('#quitaFrase').textContent = comSifrao(cents);
        $('#okBtn').textContent = parte ? 'paguei' : 'quitei';
      };
      ajusta();
      cx.addEventListener('input', () => {
        cents = +cx.value.replace(/\D/g, '');
        /** @type {HTMLButtonElement} */ ($('#okBtn')).disabled = !cents;
        ajusta();
        const bt = /** @type {HTMLButtonElement|null} */ ($('#quitaPix'));
        if (!bt) return;
        // o pix não passa da dívida da dupla: o quitei também só grava até ela
        const noPix = Math.min(cents, total);
        bt.dataset.pix = `${to}|${noPix}`;
        bt.disabled = !noPix;
        bt.querySelector('span').textContent = comSifrao(noPix);
        $('#quitaPixCode')?.remove();
      });
      cx.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && cents) $('#okBtn').click();
      });
      return p;
    };
    const certeza = await (modo === 'perdoa'
      ? ask('Perdoar?', `${nomeHtml(from)} não te deve mais ${valor}`, 'perdoar')
      : modo === 'recebi'
        ? ask('Recebeu?', `${nomeHtml(from)} te pagou ${valor}`, 'recebi')
        : pergunta());
    if (!certeza) return;
    // a nota pode estar velha: o outro lado pode já ter marcado do aparelho dele. Baixa o banco
    // e grava só o que ainda falta, senão o pagamento entra duas vezes e a dívida vira ao contrário
    await sync();
    // o que falta é o desta dupla, não o saldo de cada um: quem deve pra duas pessoas segue
    // devendo pra outra depois de pagar esta
    const t = settlements(balances()).find((x) => x.from === from && x.to === to);
    const falta = Math.min(cents, t ? t.cents : 0);
    if (!falta) return toast('Já tá quitado');
    cents = falta;
    const id = uid();
    if (AVISO_PUSH) aAvisar.add(id);
    state.expenses.push({
      id,
      kind: 'payment',
      desc: 'Pagamento',
      amount: cents / 100,
      payer: from,
      among: [to],
      at: Date.now(),
      by: me ? nameOf(me) : undefined,
      byId: me || undefined,
      forgiven: modo === 'perdoa' || undefined,
    });
    if (modo !== 'paguei') {
      // quem recebe não tem quem avisar no zap: quem devia fica sabendo pelo aviso
      commit();
      if (modo === 'recebi') festa(r.left + r.width / 2, r.top + r.height / 2);
      toast(modo === 'perdoa' ? 'Perdoado 🙏' : 'Recebido! 🎉');
      return;
    }
    seguraRisco = true;
    commit();
    festa(r.left + r.width / 2, r.top + r.height / 2);
    // pagou só uma parte: o resto segue na nota, então ainda não é quitado
    const parcial = !!t && cents < t.cents;
    toast(parcial ? 'Pago! 🎉' : 'Quitado! 🎉');
    showQuitado(to, cents, parcial);
  }
  async function excluiGasto(el) {
    const e = achaGasto(el.dataset.delExpense);
    if (!e) return;
    if (!(await ask('Excluir item?', `${esc(e.desc)} · ${comSifrao(centavos(e))}`, 'excluir'))) return;
    apagaItem(e);
    commit();
  }
  /** as abas "igual" e "partes diferentes" do anotar */
  function escolheAba(el) {
    const modo = el.dataset.modo === 'custom' ? 'custom' : 'equal';
    if (modo !== splitMode) trocaAba(modo);
  }
  const faltaNasPartes = () => totalDigitado() - Object.values(customShares()).reduce((a, b) => a + b, 0);
  /** "o resto": joga na linha o que falta pra fechar */
  function poeResto(el) {
    const i = /** @type {HTMLInputElement} */ ($(`#sharesBox input[data-share="${el.dataset.resto}"]`));
    const r = faltaNasPartes();
    if (i && r > 0) {
      i.value = reais(r);
      atualizaFalta();
    }
  }
  /** "dividir o resto igual": reparte o que falta entre as linhas vazias */
  function divideResto() {
    const vazios = inputs('#sharesBox input[data-share]').filter((i) => !lerCentavos(i.value));
    const r = faltaNasPartes();
    if (!vazios.length || r <= 0) return;
    const o = shares(
      r,
      vazios.map((i) => i.dataset.share),
    );
    for (const i of vazios) i.value = reais(o[i.dataset.share]);
    atualizaFalta();
  }
  /** @type {[string, (el: HTMLElement) => unknown][]} vale o primeiro seletor que o clique acertar */
  const CLIQUES = [
    ['#splitSeg button', escolheAba],
    ['[data-resto]', poeResto],
    ['#restoIgual', divideResto],
    // no caderno em branco a pessoa toca na caixa que fala do ✎, não no ✎: ela abre o anotar também
    ['#settle .empty.anota', () => $('#fab').click()],
    ['[data-among]', (el) => abreItem(el.closest('.item'))],
    ['[data-pix]', copiaPix],
    ['[data-undo]', tocaCarimbo],
    ['[data-settle], [data-recebi], [data-perdoa]', quita],
    ['[data-aviso]', tocaAviso],
    ['#apagaTudo', apagaTudo],
    ['[data-cobra]', cobra],
    ['[data-trocazap]', (el) => state.people.some((p) => p.id === el.dataset.trocazap) && pedeZap(el.dataset.trocazap)],
    ['[data-copy-value]', (el) => copia(el.dataset.copyValue, 'Valor copiado. Cola no app do banco.', 'Valor')],
    ['[data-del-expense]', excluiGasto],
    [
      '[data-edit-expense]',
      (el) => {
        const e = achaGasto(el.dataset.editExpense);
        if (e) editaItem(e);
      },
    ],
  ];
  document.addEventListener('click', (ev) => {
    const tgt = /** @type {HTMLElement} */ (ev.target);
    // tocar na linha de um item, fora dos botões dela, abre os detalhes (item apagado não abre)
    if (!tgt.closest('a,button,input,label')) {
      const it = /** @type {HTMLElement|null} */ (tgt.closest('.item[data-item]'));
      if (it) abreItem(it);
    }
    for (const [seletor, faz] of CLIQUES) {
      const el = /** @type {HTMLElement|null} */ (tgt.closest(seletor));
      if (el) return void faz(el);
    }
  });
  // os chips de quem divide e o ✔ das linhas das partes marcam a mesma lista
  document.addEventListener('change', (ev) => {
    const tgt = /** @type {HTMLInputElement} */ (ev.target);
    if (tgt.matches('#splitChips input')) {
      tgt.closest('.chip').classList.toggle('on', tgt.checked);
      updateHint();
    } else if (tgt.matches('#sharesBox [data-quem]')) {
      const chip = /** @type {HTMLInputElement|null} */ ($(`#splitChips input[value="${tgt.dataset.quem}"]`));
      if (chip) {
        chip.checked = tgt.checked;
        chip.closest('.chip').classList.toggle('on', tgt.checked);
      }
      updateHint();
    }
  });
  // endereço fixo: uma cópia velha em cache não pode mandar gente pro caminho antigo
  const SITE = LOCAL ? location.origin + location.pathname : 'https://tolisa.com.br/';
  // as figurinhas de cobrança, uma pasta cada: nome que se lê no link (as velhas c/h, c/i e c/j seguem de pé pros links já mandados)
  const COBRA_PASTAS = ['semverba', 'sextou', 'fiado'];
  /** a pasta escolhe o preview do link no zap: cada uma tem as suas og: e o vai.js manda pro app.
   * Sem `pasta` é cobrança, e a figurinha sai do código do evento: cada evento fica sempre com a mesma.
   * `quem` vai no &quem=: quem abrir já entra como essa pessoa
   * @param {string} [quem] @param {'pago'|'quitado'} [pasta] */
  const shareUrl = (quem = '', pasta) => {
    const dir = pasta || COBRA_PASTAS[[...roomName].reduce((a, c) => a + c.charCodeAt(0), 0) % COBRA_PASTAS.length];
    return `${SITE}${dir}/?evento=${encodeURIComponent(roomName)}${quem ? '&quem=' + quem : ''}`;
  };
  /** o link do QR, sem a pasta: preview é coisa do zap, e quem escaneia na mesa abre o evento sem o salto
   *  do vai.js. Mais curto, o QR também fica menos denso pra câmera pegar de longe */
  const linkDoQr = () => `${SITE}?evento=${encodeURIComponent(roomName)}`;
  // api.whatsapp.com, não wa.me: o redirecionamento do wa.me troca emoji acima de
  // U+FFFF (🧾 💸 👉) por U+FFFD na web
  // com o número (55 + DDD + número), o zap cai direto na conversa da pessoa
  const abreZap = (txt, tel = '') =>
    window.open(
      'https://api.whatsapp.com/send?' + (tel ? `phone=${tel}&` : '') + 'text=' + encodeURIComponent(txt),
      '_blank',
      'noopener',
    );
  // o zap de cada pessoa fica só neste aparelho (gaveta `tolisa`, em `phones`), pelo nome: vale em
  // qualquer evento. Nunca vai pro banco: lá ele ficaria à vista de quem tem o link, como o pix sem telefone.
  // '' é o "pular": não pergunta mais
  const chaveDoNome = (n) =>
    n
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  /** o número guardado ('55…'), '' se pulou, null se nunca perguntei @returns {string|null} */
  const zapDe = (id) => {
    const ps = device().phones,
      v = ps && typeof ps === 'object' ? ps[chaveDoNome(nameOf(id))] : undefined;
    return v === '' || (typeof v === 'string' && /^55\d{10,11}$/.test(v)) ? v : null;
  };
  /** `tel` undefined esquece: a próxima cobrança pergunta de novo */
  const guardaZap = (id, tel) =>
    mexe(DEVICE, (o) => {
      const ps = { ...(o.phones && typeof o.phones === 'object' ? o.phones : {}), [chaveDoNome(nameOf(id))]: tel };
      if (tel === undefined) delete ps[chaveDoNome(nameOf(id))];
      o.phones = ps;
    });
  /** número de celular ou fixo do Brasil, do jeito que vier: '55' + DDD + número, ou null */
  const telBR = (v) => {
    let d = String(v).replace(/\D/g, '').replace(/^0+/, '');
    if (/^55\d{10,11}$/.test(d)) d = d.slice(2);
    return /^\d{10,11}$/.test(d) ? '55' + d : null;
  };
  /** a primeira cobrança de alguém pede o zap dela, uma vez só. O zap abre do próprio toque
   *  no cobrar ou no pular, sem await no meio (senão o celular barra o pop-up).
   *  Sem `msg` é o trocar: guarda o número novo, ou esquece, e não abre o zap */
  function pedeZap(quem, msg = '') {
    // a agenda do celular (Contact Picker, Chrome no Android) só preenche a caixa
    const nav = /** @type {any} */ (navigator),
      agenda = nav.contacts && typeof nav.contacts.select === 'function',
      velho = msg ? '' : zapDe(quem) || '';
    overlay(
      `<h2 class="pergunta">Zap de ${nomeHtml(quem)}?</h2>
      <p class="muted recado" id="askDesc">com o número, a cobrança já cai na conversa. ele fica só neste aparelho</p>
      <form id="zapForm" autocomplete="off"><input id="askInput" type="tel" inputmode="tel" placeholder="(81) 99999-9999" value="${velho.slice(2)}">${agenda ? '<div class="c"><button type="button" id="zapAgenda" class="ghost">📇 pegar da agenda</button></div>' : ''}<button class="big">${msg ? `${WA_SVG} cobrar` : 'guardar'}</button></form>
      <div class="c voltar"><button id="zapPular" class="ghost">${msg ? 'pular' : 'esquecer o número'}</button></div>`,
    );
    const caixa = $('#askInput'),
      erro = [caixa, $('#askDesc')];
    caixa.addEventListener('input', () => erro.forEach((e) => e.classList.remove('erro')));
    /** @param {string|undefined} tel @param {boolean} [guarda] */
    const manda = (tel, guarda = true) => {
      if (guarda) guardaZap(quem, tel);
      closeOverlay();
      if (msg) abreZap(msg, tel || '');
      else render();
    };
    $('#zapForm').onsubmit = (ev) => {
      ev.preventDefault();
      // caixa vazia não é pular: cobra sem número, e a próxima cobrança pergunta de novo
      if (!caixa.value.trim()) return msg ? manda('', false) : manda(undefined);
      const tel = telBR(caixa.value);
      if (tel) return manda(tel);
      erro.forEach((e) => {
        e.classList.remove('erro');
        void e.offsetWidth;
        e.classList.add('erro');
      });
      caixa.focus();
    };
    $('#zapPular').onclick = () => manda(msg ? '' : undefined);
    if (agenda)
      $('#zapAgenda').onclick = () =>
        nav.contacts.select(['tel']).then(
          (cs) => {
            const t = cs && cs[0] && cs[0].tel && cs[0].tel[0];
            if (t && caixa.isConnected) caixa.value = t;
          },
          () => {},
        );
    caixa.focus();
  }
  /** cobrar no zap, da linha de quem me deve: o link já entra como a pessoa, e o zap abre
   *  direto do toque (nada de await antes do window.open, senão o celular barra o pop-up) */
  function cobra(el) {
    const [quem, cents] = el.dataset.cobra.split('|');
    if (!state.people.some((p) => p.id === quem)) return;
    const pix = pixKeys[me] ? `\n(pix: ${pixKeys[me]})` : '';
    const msg = `💅 ${nameOf(quem)}, não tô cobrando, só lembrando: faltam ${comSifrao(+cents)} pra ${nameOf(me)} no *${evento()}*${pix}\n\n${shareUrl(quem)}`;
    const tel = zapDe(quem);
    if (tel === null) pedeZap(quem, msg);
    else abreZap(msg, tel);
  }
  /** o link pode já dizer quem vai abrir: o grupo todo em destaque, e cada pessoa numa cápsula com contorno e pontinho na cor dela.
   * Resolve com o id escolhido, '' pra qualquer um, ou null se voltou @returns {Promise<string|null>} */
  function linkPraQuem() {
    const outros = state.people.filter((p) => p.id !== me);
    if (!outros.length) return Promise.resolve('');
    return new Promise((res) => {
      overlay(
        `<h2 class="pergunta">Mandar pra quem?</h2>
      <button class="big" data-link-pra="">👥 pro grupo todo</button>
      <div class="c muted linkou">ou um link que já entra como:</div>
      ${linkpras(outros, 'link-pra')}
      <div class="c"><button id="qrBtn" class="qrbtn">${QR_ICONE} mostrar QR</button></div>
      <div class="c voltar"><button id="cancelBtn" class="ghost">voltar</button></div>`,
      );
      overlayCancel = () => res(null);
      $('#qrBtn').onclick = () => {
        overlayCancel = null;
        res(null);
        mostraQr();
      };
      for (const b of inputs('#overlayBox [data-link-pra]'))
        b.onclick = () => {
          overlayCancel = null;
          closeOverlay();
          res(b.dataset.linkPra || '');
        };
      $('#cancelBtn').onclick = () => {
        overlayCancel = null;
        closeOverlay();
        res(null);
      };
    });
  }
  // na mesa a turma tá do lado: o QR grande do link do grupo, e quem escanear cai no evento
  const QR_ICONE =
    '<svg viewBox="0 0 7 7" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M0 0h3v3H0zM1 1v1h1V1zM4 0h3v3H4zM5 1v1h1V1zM0 4h3v3H0zM1 5v1h1V5zM4 4h1v1H4zM6 4h1v1H6zM5 5h1v1H5zM4 6h1v1H4zM6 6h1v1H6z" fill-rule="evenodd"/></svg>';
  function mostraQr() {
    const url = linkDoQr(),
      svg = qrSvg(url);
    if (!svg) return showCopy('Link do evento', url); // link comprido demais pro QR
    overlay(
      `<h2 class="pergunta">Aponta a câmera</h2>
      <div class="qr">${svg}</div>
      <p class="muted recado c">quem escanear cai no ${esc(evento())}</p>
      <div class="c voltar"><button id="cancelBtn" class="ghost">fechar</button></div>`,
    );
    $('#cancelBtn').onclick = closeOverlay;
    $('#cancelBtn').focus(); // o botão que tinha o foco sumiu com o cartão anterior
    acendeTela();
  }
  $('#shareBtn').onclick = async () => {
    const quem = await linkPraQuem();
    if (quem === null) return;
    const url = shareUrl(quem);
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiado. Quem abrir cai neste evento.');
    } catch {
      showCopy('Link do evento', url);
    }
  };
  function summaryText(quem = '') {
    const st = settlements(balances());
    const ev = evento() || 'acerto';
    if (!st.length) return `🎉 tá tudo quitado no *${ev}*!\n${shareUrl(quem, 'quitado')}`;
    // evento parado muda o tom: lembra, e depois de um mês a diva cobra (o modo chato só lembra)
    const dias = state.updatedAt ? diasDesde(state.updatedAt) : 0,
      pendurado = comSifrao(st.reduce((a, t) => a + t.cents, 0));
    const abre =
      dias >= ESQUECIDO_DIAS && !chato
        ? `💅 meu bem, o *${ev}* faz ${dias} dias e tem ${pendurado} pendurado. fiado tem limite, viu?`
        : dias >= PARADO_DIAS
          ? `👀 lembra do *${ev}*? faz ${dias} dias e ainda tem ${pendurado} pendurado…`
          : `🧾 acerto do *${ev}*`;
    return [
      abre,
      '',
      ...st.map(
        (t) =>
          `💸 ${nameOf(t.from)} paga ${comSifrao(t.cents)} pra ${nameOf(t.to)}${pixKeys[t.to] ? ` (pix: ${pixKeys[t.to]})` : ''}`,
      ),
      '',
      `tudo aqui 👉 ${shareUrl(quem)}`,
    ].join('\n');
  }
  // #endregion
  // #region imagem da comanda
  // ---------- imagem da comanda (canvas) ----------
  // a comanda é uma nota de papel impressa em fonte de máquina: cada letra tem a mesma
  // largura, então tudo se conta em colunas, como numa impressora de cupom
  async function renderReceipt() {
    await document.fonts.load("28px 'VT323'");
    const saldo = balances(),
      acerto = settlements(saldo);
    const items = [...state.expenses.filter((e) => e.kind !== 'payment')].reverse();
    const totalCents = items.reduce((a, e) => a + centavos(e), 0);
    const LARGURA = 720, // da imagem
      MARGEM = 24, // a borda escura em volta do papel
      RECUO = 36, // da beira do papel até o texto
      ESCALA = 2, // pixels de verdade por pixel desenhado (fica nítido no celular)
      FONTE = 28,
      ENTRELINHA = 34;
    const ESQ = MARGEM + RECUO; // onde o texto começa
    const TINTA = '#2a2a2a',
      TINTA_CLARA = '#5a5a5a',
      PAPEL = '#efe9d8',
      VERDE = '#15703a';
    // a comanda mostra só os itens mais novos: viagem de uma semana passava de 12 mil px e o
    // Safari do iPhone não gera imagem acima de ~16 Mpx. O total soma tudo, o resto fica no link
    const TETO_ITENS = 25;
    const agora = new Date();
    /** escreve a comanda inteira e diz em que altura ela acabou
     *  @param {CanvasRenderingContext2D} ctx */
    const desenha = (ctx) => {
      ctx.font = `${FONTE}px 'VT323'`;
      ctx.textBaseline = 'alphabetic';
      const larguraLetra = ctx.measureText('M').width,
        COLUNAS = Math.floor((LARGURA - 2 * MARGEM - 2 * RECUO) / larguraLetra);
      let y = MARGEM + 12 + 50; // a linha em que o próximo texto entra

      /** pinta o marca-texto atrás de `len` letras a partir da coluna `col` da linha atual */
      const marcaTexto = (col, len, cor) => {
        ctx.fillStyle = cor;
        ctx.fillRect(ESQ + col * larguraLetra - 3, y - FONTE * 0.72, len * larguraLetra + 6, FONTE * 0.9);
      };
      const maiusc = (t) => String(t).toUpperCase();
      // a coluna continua contada em unidade UTF-16, que é o que a régua do papel usa;
      // o apara() só não deixa a conta parar no meio de um par surrogate
      /** o texto em maiúsculas, cortado com … se passar de n colunas */
      const cabe = (t, n) => {
        t = maiusc(t);
        return t.length > n ? apara(t.slice(0, Math.max(1, n - 1))) + '…' : t;
      };
      const escreve = (t, cor = TINTA) => {
        ctx.fillStyle = cor;
        ctx.textAlign = 'left';
        ctx.fillText(t, ESQ, y);
        y += ENTRELINHA;
      };
      const centraliza = (t) => {
        ctx.textAlign = 'center';
        ctx.fillStyle = TINTA;
        ctx.fillText(t, LARGURA / 2, y);
        y += ENTRELINHA;
      };
      const traco = () => escreve('-'.repeat(COLUNAS), TINTA_CLARA);
      const pula = () => {
        y += ENTRELINHA * 0.6;
      };
      /** "ALGO ........ VALOR", ocupando a linha toda */
      const comPontinhos = (l, v) => {
        l = cabe(l, COLUNAS - 10 - 2); // guarda 10 colunas pro valor
        const pontos = '.'.repeat(Math.max(1, COLUNAS - l.length - v.length - 2));
        return `${l} ${pontos} ${v}`;
      };
      // as iniciais de quem divide ("F J L"): letras suficientes pra ninguém se confundir
      const semAcento = (t) => maiusc(t).normalize('NFD').replace(/[̀-ͯ]/g, '');
      const primeiras = (t, k) => apara(t.slice(0, k));
      const inicial = (id) => {
        const n = semAcento(nameOf(id));
        let k = 1;
        while (
          k < n.length &&
          state.people.some((p) => p.id !== id && primeiras(semAcento(nameOf(p.id)), k) === primeiras(n, k))
        )
          k++;
        return primeiras(n, k);
      };
      /** escreve pedaços de texto, com marca-texto nos que têm `id`, quebrando a linha
       *  quando o próximo pedaço (ou `w` colunas) não cabe
       *  @param {{ t: string, id?: string, w?: number }[]} pedacos */
      const escreveQuebrando = (pedacos) => {
        let col = 0,
          t = '';
        for (const p of pedacos) {
          if (!p.t) continue;
          if (col > 2 && col + (p.w || p.t.length) > COLUNAS) {
            escreve(t.trimEnd(), TINTA_CLARA);
            t = '  ';
            col = 2;
          }
          if (p.id) marcaTexto(col, p.t.length, markForte(p.id));
          t += p.t;
          col += p.t.length;
        }
        if (t.trim()) escreve(t.trimEnd(), TINTA_CLARA);
      };

      // cabeçalho
      const data = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + 'H';
      centraliza(`*** TÔ LISA ***`);
      centraliza(cabe(`${maiusc(evento())} · ${data} ${hora}`, COLUNAS));
      pula();
      traco();

      // saldo: quem ainda paga quem, e depois quem já está quite
      pula();
      centraliza('*** FALTA PAGAR ***');
      pula();
      if (!acerto.length) centraliza('TUDO QUITADO');
      for (const t of acerto) {
        const de = cabe(nameOf(t.from), 12),
          pra = cabe(nameOf(t.to), 12);
        marcaTexto(0, de.length, markForte(t.from));
        marcaTexto(de.length + 6, pra.length, markForte(t.to));
        escreve(comPontinhos(`${de} PAGA ${pra}`, 'R$ ' + reais(t.cents)));
      }
      const quites = state.people.filter((p) => (saldo[p.id] || 0) === 0);
      if (quites.length && acerto.length) pula();
      for (const p of quites) {
        const n = cabe(nameOf(p.id), COLUNAS - 16);
        marcaTexto(0, n.length, markForte(p.id));
        escreve(comPontinhos(n, 'QUITE'), VERDE);
      }
      traco();

      // itens: descrição ...... valor, com quem pagou e como dividiu embaixo
      pula();
      centraliza('*** ITENS ***');
      pula();
      if (!items.length) escreve('NADA ANOTADO');
      for (const e of items.slice(0, TETO_ITENS)) {
        escreve(comPontinhos(e.desc, reais(centavos(e))));
        const pagou = cabe(nameOf(e.payer), 14);
        marcaTexto(2, pagou.length, markForte(e.payer));
        /** @type {{ t: string, id?: string, w?: number }[]} */
        const pedacos = [{ t: '  ' }, { t: pagou, id: e.payer }, { t: ' PAGOU · ' }];
        const virgula = (i) => (i < e.among.length - 1 ? ', ' : '');
        if (!ehIgual(e)) {
          // partes diferentes: cada nome com o valor dele
          e.among.forEach((id, i) => {
            const n = cabe(nameOf(id), 14),
              v = ' ' + reais(e.shares[id] || 0);
            pedacos.push({ t: n, id, w: n.length + v.length }, { t: v + virgula(i) });
          });
          escreveQuebrando(pedacos);
          continue;
        }
        if (!e.among.includes(e.payer)) {
          // empréstimo: quem pagou não entra na divisão
          e.among.forEach((id, i) => pedacos.push({ t: cabe(nameOf(id), 14), id }, { t: virgula(i) }));
          pedacos.push({ t: ` DEVE${e.among.length === 1 ? '' : 'M'} TUDO` });
          escreveQuebrando(pedacos);
          continue;
        }
        if (state.people.every((p) => e.among.includes(p.id))) {
          escreve('  ' + cabe(`${pagou} pagou · ÷${e.among.length} todos`, COLUNAS - 2), TINTA_CLARA);
          continue;
        }
        // igual entre alguns: as iniciais de quem divide, até onde couber
        const inicio = `  ${pagou} PAGOU · ÷${e.among.length} `;
        let col = inicio.length,
          t = inicio;
        for (const id of e.among) {
          const ini = inicial(id);
          if (col + ini.length > COLUNAS) break;
          marcaTexto(col, ini.length, markForte(id));
          t += ini + ' ';
          col += ini.length + 1;
        }
        escreve(t.trimEnd(), TINTA_CLARA);
      }
      if (items.length > TETO_ITENS) {
        pula();
        centraliza(`+ ${items.length - TETO_ITENS} ITENS · TUDO NO LINK`);
      }
      pula();
      escreve(comPontinhos('TOTAL', 'R$ ' + reais(totalCents)), TINTA_CLARA);
      traco();
      pula();
      centraliza('* * *');

      // o QR do link do grupo, como o da nota fiscal: a imagem encaminhada sem o texto ainda leva pro evento
      const qr = qrMatriz(linkDoQr());
      if (qr) {
        const MODULO = 4,
          lado = qr.length * MODULO,
          qx = LARGURA / 2 - lado / 2,
          qy = Math.round(y); // pixel inteiro: módulo em meio pixel deixa fresta clara entre um e outro
        ctx.fillStyle = TINTA;
        qr.forEach((l, i) =>
          l.forEach((preto, j) => preto && ctx.fillRect(qx + j * MODULO, qy + i * MODULO, MODULO, MODULO)),
        );
        y += lado + ENTRELINHA;
      }
      // o código de barras do rodapé, o mesmo da página
      {
        const barras = code128Widths('420420420420');
        const unidades = [...barras].reduce((a, n) => a + +n, 0);
        const LARG_BARRAS = 240,
          ALT_BARRAS = 40,
          porUnidade = LARG_BARRAS / unidades;
        let bx = LARGURA / 2 - LARG_BARRAS / 2;
        ctx.fillStyle = TINTA;
        for (let i = 0; i < barras.length; i++) {
          const w = +barras[i] * porUnidade;
          if (i % 2 === 0) ctx.fillRect(bx, y - 8, w, ALT_BARRAS); // posição par é barra, ímpar é vão
          bx += w;
        }
        y += ALT_BARRAS + 4;
      }
      ctx.fillStyle = TINTA_CLARA;
      ctx.textAlign = 'center';
      ctx.fillText('tolisa.com.br', LARGURA / 2, y + 16);
      y += ENTRELINHA + 6;
      return y;
    };

    // o papel na altura exata: o texto quebra conforme os nomes, então a altura só se sabe
    // escrevendo. Primeiro escreve num rascunho de 1 px só pra medir, depois no papel de verdade:
    // fundo escuro, papel com a borda picotada em zigue-zague em cima e embaixo, riscos bem
    // leves de papel térmico, e o texto por cima
    const ALTURA =
      desenha(/** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d'))) +
      MARGEM +
      12;
    const papel = document.createElement('canvas');
    papel.width = LARGURA * ESCALA;
    papel.height = ALTURA * ESCALA;
    const p = papel.getContext('2d');
    p.scale(ESCALA, ESCALA);
    p.fillStyle = '#262626';
    p.fillRect(0, 0, LARGURA, ALTURA);
    p.fillStyle = PAPEL;
    p.fillRect(MARGEM, MARGEM + 12, LARGURA - 2 * MARGEM, ALTURA - 2 * MARGEM - 24);
    for (let i = 0; i < (LARGURA - 2 * MARGEM) / 12; i++) {
      const x = MARGEM + i * 12;
      p.beginPath();
      p.moveTo(x, MARGEM + 12);
      p.lineTo(x + 6, MARGEM);
      p.lineTo(x + 12, MARGEM + 12);
      p.fill();
      p.beginPath();
      p.moveTo(x, ALTURA - MARGEM - 12);
      p.lineTo(x + 6, ALTURA - MARGEM);
      p.lineTo(x + 12, ALTURA - MARGEM - 12);
      p.fill();
    }
    p.fillStyle = 'rgba(0,0,0,.03)';
    for (let yy = MARGEM; yy < ALTURA - MARGEM; yy += 4) p.fillRect(MARGEM, yy, LARGURA - 2 * MARGEM, 1);
    desenha(p);
    return new Promise((res) => papel.toBlob(res, 'image/png'));
  }
  // compartilhar começa perguntando pra quem é o link: quem abrir já entra como essa pessoa
  $('#waBtn').onclick = async () => {
    const btn = $('#waBtn');
    const quem = await linkPraQuem();
    if (quem === null) return;
    const waText = () => abreZap(summaryText(quem));
    btn.disabled = true;
    toast('Gerando a imagem…');
    try {
      const blob = await renderReceipt();
      const file = new File([blob], `evento-${evento() || 'grupo'}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: summaryText(quem) });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return;
        }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('Imagem baixada. Abrindo o WhatsApp com o texto…');
      waText();
    } catch (e) {
      toast('Não consegui gerar a imagem: ' + e.message);
      waText();
    } finally {
      btn.disabled = false;
    }
  };
  if ('serviceWorker' in navigator && location.protocol === 'https:')
    navigator.serviceWorker.register('sw.js').catch(() => {});

  // #endregion
  // #region instalar
  // ---------- instalar na tela de início ----------
  // O navegador avisa que dá (beforeinstallprompt) e espera o site pedir. O #instalar,
  // no topo, embaixo do subtítulo, pede; o toque do ✎ também convida, uma vez só, na segunda visita e só
  // com gasto anotado. No iPhone o evento não existe: o botão ensina o caminho do Safari.
  let convite = null;
  const jaInstalado = () =>
    matchMedia('(display-mode: standalone)').matches || /** @type {any} */ (navigator).standalone === true; // standalone é só do Safari
  const ehIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad se passa por Mac
  const mostraInstalar = () =>
    $('#instalar').classList.toggle('hidden', !INSTALAR || jaInstalado() || !(convite || ehIOS()));
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    convite = ev;
    mostraInstalar();
  });
  window.addEventListener('appinstalled', () => {
    convite = null;
    setDevice('installPrompted', true);
    mostraInstalar();
    toast('Instalado! 🎉');
  });
  /** o convite do navegador: o evento só serve pra um prompt(), depois some e o navegador manda
   *  outro quando quiser. Aceite ou recuse, o ✎ e o 🔔 não perguntam de novo */
  async function pedeInstalar() {
    const c = convite;
    convite = null;
    setDevice('installPrompted', true);
    mostraInstalar();
    c.prompt();
    return (await c.userChoice).outcome === 'accepted';
  }
  $('#instalar').onclick = async () => {
    if (convite) {
      if (!(await pedeInstalar())) toast('Deixa pra próxima, meu bem.');
      return;
    }
    ensinaInstalar();
  };
  /** o navegador de dentro do Facebook e do Instagram não instala. O Chrome e o Edge do iPhone instalam
   *  pelo Compartilhar deles desde o iOS 16.4, então seguem com o passo a passo */
  const foraDoSafari = () => /FBAN|FBAV|Instagram/.test(navigator.userAgent);
  /** o passo a passo do Safari, com o porquê em cima quando quem pediu foi o 🔔 (HTML: já vem escapado) */
  function ensinaInstalar(porque = '') {
    if (foraDoSafari()) {
      // o Safari não enxerga o que este navegador guardou: o link do evento já entra como a pessoa
      const link = groupId ? shareUrl(me || '') : SITE;
      overlay(`<h2>Instalar</h2>${porque ? `<p class="porque">${porque}</p>` : ''}
        <p class="porque">Daqui não dá pra instalar: só pelo <b>Safari</b>. Copia o link, abre o Safari e cola lá em cima.</p>
        <button id="instLink" class="big">copiar o link</button>
        <div class="c voltar"><button id="instOk" class="ghost">fechar</button></div>`);
      $('#instLink').onclick = () => copia(link, 'Link copiado. Agora cola no Safari.', 'Link pro Safari');
      $('#instOk').onclick = closeOverlay;
      return;
    }
    // quadrinhos: cada passo com o desenho do que vai aparecer no Safari e o botão a tocar
    // pintado, e uma seta pulando em cima do lugar de verdade. O Safari 26 guarda o
    // Compartilhar no •••, no canto de baixo; o antigo deixa ele no meio da barra de baixo,
    // e o iPad, em cima
    const ver = +((navigator.userAgent.match(/Version\/(\d+)/) || [])[1] || 26);
    const ipad = /ipad/i.test(navigator.userAgent) || navigator.platform === 'MacIntel';
    const onde = ipad ? 'cima' : ver >= 26 ? 'canto' : 'meio';
    const passo = (n, tela, txt) =>
      `<div class="passo"><div class="tela">${tela}</div><p><b>${n}.</b> ${txt}</p></div>`;
    const compartilhar = (n) =>
      passo(
        n,
        `<span>Copiar</span><span class="toca">${SHARE_SVG} Compartilhar</span>`,
        'toque em <b>Compartilhar</b>.',
      );
    const tela = (n) =>
      passo(
        n,
        `<span>Adicionar aos Favoritos</span><span class="toca">${MAIS_SVG} Tela de Início</span>`,
        'desça e toque em <b>Adicionar à Tela de Início</b>.',
      );
    const passos =
      onde === 'canto'
        ? passo(
            1,
            `<div class="barra"><span>tolisa.com.br</span><span class="toca">•••</span></div>`,
            'toque no <b>•••</b> lá embaixo.',
          ) +
          compartilhar(2) +
          tela(3)
        : passo(
            1,
            `<div class="barra"><span class="toca">${SHARE_SVG}</span></div>`,
            `toque no <b>${SHARE_SVG}</b> lá ${onde === 'cima' ? 'em cima' : 'embaixo'}.`,
          ) + tela(2);
    overlay(`<h2>Instalar</h2>${porque ? `<p class="porque">${porque}</p>` : ''}${passos}
      <button id="instOk" class="sec" style="margin-top:10px">entendi</button>
      <svg class="seta ${onde}" width="150" height="190" viewBox="0 0 150 190" aria-hidden="true"><path d="M20 8C30 90 70 150 122 176"/><path d="M96 178H124L116 152"/></svg>`);
    $('#overlay').classList.add('ensina', onde);
    $('#instOk').onclick = closeOverlay;
  }
  mostraInstalar();
  function convidaInstalar() {
    if (!INSTALAR || !convite || device().installPrompted || jaInstalado()) return;
    if (visitas < 2 || !state || !state.expenses.length) return;
    pedeInstalar().catch(() => {});
  }
  function festa(x, y) {
    if (semMovimento()) return;
    const box = document.createElement('div');
    box.className = 'confete';
    box.style.left = x + 'px';
    box.style.top = y + 'px';
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('i');
      const ang = Math.random() * Math.PI * 2,
        d = 50 + Math.random() * 130;
      s.style.cssText = `--dx:${(Math.cos(ang) * d).toFixed(0)}px;--dy:${(Math.sin(ang) * d - 60).toFixed(0)}px;--rot:${(Math.random() * 900 - 450).toFixed(0)}deg;--del:${(Math.random() * 90).toFixed(0)}ms;background:${corDe(i)}`;
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 1400);
  }
  // #endregion
  // #region a ficha do rodapé
  // ---------- a ficha do rodapé (a diva) ----------
  // a diva só é jogada quando o código de barras entra na tela. O lugar sai de
  // uma lista de cantos ao redor do código, sempre acima do "sincronizado", e o
  // voo às vezes vem direto, às vezes dando cambalhota
  (function jogaDiva() {
    const el = /** @type {HTMLElement|null} */ (document.querySelector('.stain'));
    const bars = /** @type {HTMLElement|null} */ (document.querySelector('.bars'));
    if (!el || !bars) return;
    const r = (a, b) => a + Math.random() * (b - a);
    const D = 70,
      folga = 6; // tamanho da figurinha
    let slot = 0;
    /** as vagas vazias do rodapé, medidas na página de agora */
    const vagas = () => {
      const papelOu = bars.offsetParent;
      if (!papelOu) return null; // escondido (tela de código, carregando)
      const bt = bars.offsetTop,
        bl = bars.offsetLeft,
        bw = bars.offsetWidth,
        bh = bars.offsetHeight;
      const papel = /** @type {HTMLElement} */ (papelOu);
      const larg = papel.clientWidth,
        alt = papel.clientHeight;
      const st = $('#status'),
        sy = st ? st.offsetTop - D * 0.35 : bt + bh;
      const frase = $('#signoff'),
        caixa = frase && frase.parentElement;
      // teto: a linha tracejada logo acima do "* * *". Dali pra cima é conta, não é rodapé.
      const topo = caixa ? caixa.offsetTop - D * 0.4 : bt - D * 0.25;
      const base = bt + bh - D + folga;
      // a ficha cai inteira dentro do papel: a folga cobre o empurrãozinho do --dx/--dy
      const yMax = Math.max(topo, alt - D - 12);
      const dentro = (p) => ({ x: Math.max(12, Math.min(p.x, larg - D - 12)), y: Math.min(Math.max(p.y, topo), yMax) });
      const v = [
        { x: bl + bw - D * 0.9, y: base }, // ponta direita do código
        { x: bl, y: base }, // ponta esquerda do código
        { x: bl + bw / 2 - D / 2, y: base }, // em cima do código, no meio
        { x: bl + bw - D, y: bt - D * 0.25 }, // topo do código, à direita
        { x: bl, y: bt - D * 0.25 }, // topo do código, à esquerda
        { x: 12, y: sy }, // ao lado do sincronizado, à esquerda
        { x: larg - D - 12, y: sy }, // ao lado do sincronizado, à direita
      ];
      // ao lado do "valeu, meu bem!" só entra se sobrar vão dos dois lados: recado não se tapa
      if (caixa && frase) {
        const vao = (larg - frase.offsetWidth) / 2;
        if (vao >= D + 14) {
          const fy = caixa.offsetTop + caixa.offsetHeight / 2 - D / 2;
          v.push({ x: 12, y: fy }, { x: larg - D - 12, y: fy });
        }
      }
      return v.map(dentro);
    };
    const vaga = (i) => {
      const v = vagas();
      return v && v[i];
    };
    // a página muda de altura ao longo da vida (entrar no evento, abrir itens),
    // então a vaga é recalculada, não guardada em pixels
    const posiciona = () => {
      const p = vaga(slot);
      if (!p || el.classList.contains('solta') || el.classList.contains('largada')) return;
      el.style.left = Math.round(p.x) + 'px';
      el.style.top = Math.round(p.y) + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    };
    const sorteiaVaga = () => {
      const v = vagas();
      slot = Math.floor(Math.random() * (v ? v.length : 5));
      posiciona();
      el.style.setProperty('--dx', r(-8, 8).toFixed(1) + 'px');
      el.style.setProperty('--dy', r(-6, 6).toFixed(1) + 'px');
      el.style.setProperty('--rot', r(-28, 12).toFixed(1) + 'deg');
      // a ficha é jogada de fora do papel: entra pela esquerda, pela direita ou de baixo
      const vindo = Math.floor(Math.random() * 3);
      const vx = vindo === 0 ? -r(170, 280) : vindo === 1 ? r(170, 280) : r(-70, 70);
      // ela pode nascer fora do papel, mas não abaixo do fim da página: o documento
      // cresceria no meio do voo e a barra de rolagem encolhia na mão de quem lê.
      // A folga é o rodapé do body, que é onde ainda cabe ficha sem esticar nada
      const papel = /** @type {HTMLElement|null} */ (bars.offsetParent);
      const folgaBaixo = papel
        ? Math.max(
            0,
            document.documentElement.scrollHeight - (papel.offsetTop + (parseFloat(el.style.top) || 0) + D) - 8,
          )
        : 0;
      const vy = Math.min(vindo === 2 ? r(140, 230) : r(-30, 60), folgaBaixo);
      el.style.setProperty('--vx', vx.toFixed(0) + 'px');
      el.style.setProperty('--vy', vy.toFixed(0) + 'px');
      // quase sempre um voo só; de vez em quando cambalhota, e raramente ela teima e quica de novo
      const jeito = Math.random();
      el.classList.toggle('cambalhota', jeito < 0.4);
      el.classList.toggle('requica', jeito >= 0.4 && jeito < 0.52);
    };
    sorteiaVaga();
    if ('ResizeObserver' in window) new ResizeObserver(posiciona).observe($('#app'));
    window.addEventListener('resize', posiciona);
    // a ficha espera a pessoa chegar no fim da página (numa tela alta o código de barras
    // já aparece na abertura, e ela cairia sem ninguém ver). Na fila ela vem logo depois
    // dos riscos, antes do Sou Fulano e do ✎, que esperam ela.
    const DIVA_MS = 1100,
      FOLGA = 8;
    const noFim = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - FOLGA;
    let jogada = false,
      marcada = false,
      aviso = 0;
    ficha.vem = () => {
      if (!jogada) confere();
      return !chato && jogada && !marcada;
    };
    const confere = () => {
      // ainda carregando, a nota é só o spinner: numa tela alta isso já é o "fim da
      // página" e a ficha caía antes do evento existir
      if (chato || jogada || $('#app').classList.contains('loading')) return;
      if (el.classList.contains('hidden') || !noFim()) return; // nota sem gasto: a ficha espera
      // com cartão ou o anotar abertos ela cairia por trás, sem ninguém ver: espera fechar
      if (!semCartao() || !$('#sheet').classList.contains('hidden')) return;
      jogada = true;
      sorteiaVaga();
      clearTimeout(aviso);
      // as seções só entram na fila depois que o #app sai do loading e o observador
      // reporta; pegar a vez no mesmo quadro fazia a ficha furar tudo. Um respiro e
      // aí sim ela pega o último lugar.
      aviso = setTimeout(() => {
        const t = agenda(DIVA_MS);
        marcada = true;
        render(); // agora o Sou Fulano e o ✎ entram, atrás dela
        aviso = setTimeout(
          () => {
            el.classList.add('voou');
            // sem animação (movimento reduzido) não há animationend: já pousa
            if (semMovimento()) {
              el.classList.remove('voou');
              el.classList.add('pousou');
            }
          },
          Math.max(0, t - Date.now()),
        );
      }, 400);
    };
    window.addEventListener('scroll', confere, { passive: true });
    window.addEventListener('resize', confere);
    if ('ResizeObserver' in window) new ResizeObserver(confere).observe($('#app'));
    for (const q of ['#overlay', '#sheet'])
      new MutationObserver(confere).observe($(q), { attributes: true, attributeFilter: ['class'] });
    // uma jogada só: chegar no fim de novo não traz outra, até o ficha.rejoga() (trocou de
    // nome, a ficha entrou num botão, a diva voltou a falar).
    // pousou: a ficha passa a ser pegável. Dois toques ela treme; o terceiro já agarra,
    // no mesmo gesto. Agarrada, sai do papel pro body (fixed dentro de algo com
    // transform não fica fixo) e segue o dedo; solta devagar, assenta no papel; solta num
    // botão, aperta ele; solta com força, voa na direção do arremesso e some.
    const casa = el.parentElement,
      depois = el.nextSibling;
    // no aparelho de toque o dedo vai junto com a ficha; com mouse o gesto não fecha
    const pegavel = PEGA_FICHA || navigator.maxTouchPoints > 0;
    if (pegavel) document.body.classList.add('pegavel');
    // graus por px: uma volta a cada perímetro da ficha (70px de diâmetro)
    const ROLA = 360 / (Math.PI * 70);
    let toques = 0,
      zera = 0,
      pega = null,
      voo = 0;
    // soltar a ficha em cima de um botão aperta ele, que nem ficha em fenda de máquina: no
    // ▸ dos itens abre a lista, no ✔ quita (que já pergunta antes), no copiar pix copia.
    // Vale o centro da ficha, não a ponta do dedo, e só depois de arrastar de verdade:
    // agarrar e soltar no lugar, ou um arremesso que passa voando por cima, não aperta nada
    const ALVOS =
      '#itemsHead, [data-settle], [data-pix], [data-copy-value], #fab, #waBtn, #shareBtn, #whoBtn, #roomLabel, #toggleAll';
    const ARRASTO = 24; // px do dedo até a ficha passar a mirar
    /** @returns {HTMLElement|null} o botão debaixo do centro da ficha */
    const mirado = () => {
      const b = el.getBoundingClientRect(),
        x = b.left + b.width / 2,
        y = b.top + b.height / 2;
      const n = document.elementsFromPoint(x, y).find((n) => n !== el);
      const a = /** @type {HTMLElement|null} */ (n && n.closest(ALVOS));
      if (!a || a.classList.contains('hidden') || /** @type {HTMLButtonElement} */ (a).disabled) return null;
      // o centro tem que cair no botão mesmo: a folga que o ✔ ganha pro dedo não vale pra ficha
      const r = a.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? a : null;
    };
    // o botão mirado acende, e a ficha fica meio transparente pra ele aparecer por baixo
    let mira = null;
    const aponta = (a) => {
      if (a === mira) return;
      if (mira) mira.classList.remove('mira');
      mira = a;
      if (a) a.classList.add('mira');
      el.classList.toggle('mirando', !!a);
    };
    // segurada perto da borda de cima ou de baixo, a página rola por baixo dela: da ficha
    // no rodapé até o ✔ lá em cima, numa nota comprida, sem ter outro dedo pra rolar
    const BORDA = 80,
      RAPIDO = 16; // px da borda onde começa a rolar; px por quadro, no talo
    let rola = 0;
    const rolaBorda = () => {
      if (!pega) return;
      // quanto rolar: de -1 (no talo pra cima) a 1 (no talo pra baixo), 0 longe das bordas
      const y = pega.y;
      let v = 0;
      if (pega.andou && y < BORDA) v = -(BORDA - y) / BORDA;
      else if (pega.andou && y > innerHeight - BORDA) v = (y - innerHeight + BORDA) / BORDA;
      if (v) {
        const antes = scrollY;
        scrollBy(0, Math.round(Math.max(-1, Math.min(1, v)) * RAPIDO));
        if (scrollY !== antes) aponta(mirado());
      }
      rola = requestAnimationFrame(rolaBorda);
    };
    // nada de ler layout entre tirar o segura e pôr o engole: a leitura fixaria a ficha
    // opaca no meio do caminho e ela piscava inteira antes de sumir
    const engole = (alvo) => {
      const r = alvo.getBoundingClientRect(),
        tranco = alvo.matches('#mineRows .dupla > button.ico') ? 'tocou' : 'engoliu';
      el.classList.remove('segura');
      aponta(null);
      el.style.left = r.left + r.width / 2 - D / 2 + 'px';
      el.style.top = r.top + r.height / 2 - D / 2 + 'px';
      el.style.setProperty('--rot', ((parseFloat(el.style.getPropertyValue('--rot')) || 0) + 160).toFixed(1) + 'deg');
      el.classList.add('engole');
      // o clique vem já, ainda dentro do gesto: copiar pro clipboard e abrir o zap só valem com o dedo acabando de sair
      alvo.click();
      // o botão dá o tranco de quem recebeu: o ✔ e o copiar pix com o toque deles, o resto um pulinho
      alvo.classList.remove(tranco);
      void alvo.offsetWidth;
      alvo.classList.add(tranco);
      alvo.addEventListener('animationend', () => alvo.classList.remove(tranco), { once: true });
      // entrou, some; volta a cair da próxima vez que a pessoa chegar no fim da página.
      // O relógio de reserva é pra quando a transição não roda (aba escondida)
      const some = () => {
        el.removeEventListener('transitionend', apagou);
        clearTimeout(reserva);
        el.classList.add('fora');
        ficha.rejoga();
      };
      const apagou = (e) => {
        if (e.propertyName === 'opacity') some();
      };
      el.addEventListener('transitionend', apagou);
      const reserva = setTimeout(some, 900);
    };
    el.addEventListener('animationend', (e) => {
      if (e.animationName === 'treme') el.classList.remove('treme');
      // pousada, larga as classes do voo: a cambalhota vence o pousou no CSS e rejogava a cada toque
      else if (el.classList.contains('voou')) {
        el.classList.remove('voou', 'cambalhota', 'requica');
        el.classList.add('pousou');
      }
    });
    el.addEventListener('dragstart', (e) => e.preventDefault());
    // no iOS o preventDefault do pointerdown não segura a seleção do toque longo; o do
    // touchstart segura. Só com ela pousada: voando ela nem pega toque (pointer-events)
    el.addEventListener(
      'touchstart',
      (e) => {
        if (pegavel && el.classList.contains('pousou')) e.preventDefault();
      },
      { passive: false },
    );
    el.addEventListener('pointerdown', (e) => {
      if (!pegavel || !el.classList.contains('pousou')) return;
      e.preventDefault();
      clearTimeout(zera);
      if (!el.classList.contains('solta') && !el.classList.contains('largada') && ++toques < 3) {
        el.classList.remove('treme');
        void el.offsetWidth;
        el.classList.add('treme');
        zera = setTimeout(() => {
          toques = 0;
        }, 1500);
        return;
      }
      toques = 0;
      cancelAnimationFrame(voo);
      const b = el.getBoundingClientRect();
      if (!el.classList.contains('solta')) {
        document.body.appendChild(el);
        el.classList.remove('treme', 'largada');
        el.classList.add('solta');
      }
      const cx = b.left + (b.width - el.offsetWidth) / 2,
        cy = b.top + (b.height - el.offsetHeight) / 2;
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      el.classList.remove('voando');
      el.classList.add('segura');
      pega = {
        dx: e.clientX - cx,
        dy: e.clientY - cy,
        x: e.clientX,
        x0: e.clientX,
        y0: e.clientY,
        y: e.clientY,
        andou: false,
        rot: parseFloat(el.style.getPropertyValue('--rot')) || -16,
        rastro: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
      };
      el.setPointerCapture(e.pointerId);
      cancelAnimationFrame(rola);
      rola = requestAnimationFrame(rolaBorda);
    });
    el.addEventListener('pointermove', (e) => {
      if (!pega) return;
      el.style.left = e.clientX - pega.dx + 'px';
      el.style.top = e.clientY - pega.dy + 'px';
      // rola com o dedo, que nem moeda na mesa: cada px pro lado gira o que a borda andou
      pega.rot += (e.clientX - pega.x) * ROLA;
      pega.x = e.clientX;
      pega.y = e.clientY;
      el.style.setProperty('--rot', pega.rot.toFixed(1) + 'deg');
      pega.rastro.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      while (pega.rastro.length > 2 && e.timeStamp - pega.rastro[0].t > 90) pega.rastro.shift();
      if (!pega.andou) pega.andou = Math.hypot(e.clientX - pega.x0, e.clientY - pega.y0) > ARRASTO;
      if (pega.andou) aponta(mirado());
    });
    // largada devagar, a ficha volta pro papel no ponto em que parou: presa na tela ela
    // ficava boiando por cima de tudo, andando junto com a rolagem
    const assenta = () => {
      const vx = parseFloat(el.style.left),
        vy = parseFloat(el.style.top);
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) return;
      if (el.parentElement !== casa) casa.insertBefore(el, depois);
      el.classList.remove('solta', 'voando');
      el.classList.add('largada');
      const c = casa.getBoundingClientRect();
      el.style.setProperty('--dx', '0px');
      el.style.setProperty('--dy', '0px');
      el.style.left = Math.round(vx - c.left) + 'px';
      el.style.top = Math.round(vy - c.top) + 'px';
    };
    const solta = (e) => {
      if (!pega) return;
      const p0 = pega.rastro[0],
        dt = Math.max(16, e.timeStamp - p0.t);
      let vx = (e.clientX - p0.x) / dt,
        vy = (e.clientY - p0.y) / dt; // px por ms
      // pointercancel é o sistema tomando o gesto, não a pessoa soltando: não aperta nada
      const alvo = e.type === 'pointerup' && pega.andou ? mirado() : null;
      pega = null;
      // em cima de um botão, a mão que desacelera mirando ainda conta como largar
      if (alvo && Math.hypot(vx, vy) < 1.2) return engole(alvo);
      el.classList.remove('segura');
      aponta(null);
      if (Math.hypot(vx, vy) < 0.7) return assenta(); // devagar: assenta onde parou
      // arremesso: sai mais rápido que a mão e segue reto com gravidade, girando no
      // mesmo sentido em que rolava, até sair da tela
      vx *= 1.8;
      vy *= 1.8;
      el.classList.add('voando');
      let x = parseFloat(el.style.left),
        y = parseFloat(el.style.top),
        rot = parseFloat(el.style.getPropertyValue('--rot')) || 0,
        t = performance.now();
      const giro = vx * ROLA;
      const passo = (agora) => {
        const d = Math.min(40, agora - t);
        t = agora;
        vy += 0.0025 * d;
        x += vx * d;
        y += vy * d;
        rot += giro * d;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.setProperty('--rot', rot.toFixed(1) + 'deg');
        if (x < -D * 2 || x > innerWidth + D || y > innerHeight + D || y < -innerHeight) {
          el.classList.add('fora');
          return;
        }
        voo = requestAnimationFrame(passo);
      };
      voo = requestAnimationFrame(passo);
    };
    el.addEventListener('pointerup', solta);
    el.addEventListener('pointercancel', solta);
    ficha.rejoga = () => {
      clearTimeout(aviso);
      cancelAnimationFrame(voo);
      jogada = marcada = false;
      pega = null;
      toques = 0;
      aponta(null);
      if (el.parentElement !== casa) casa.insertBefore(el, depois);
      el.classList.remove('voou', 'pousou', 'treme', 'solta', 'largada', 'segura', 'voando', 'fora', 'apaga', 'engole');
      confere();
    };
    // a senha na ficha desliga a diva: ela apaga onde estiver e para de falar
    senha(el, () => {
      chato = true;
      setDevice('boringMode', true);
      pega = null;
      cancelAnimationFrame(voo);
      aponta(null);
      el.classList.remove('segura', 'treme');
      el.classList.add('apaga');
      setTimeout(() => {
        document.body.classList.add('chato');
        render();
      }, 700);
    });
    // e no "Deus é fiel." do rodapé, liga de novo: ela volta falando e é jogada outra vez
    const frase = $('#signoff');
    if (frase)
      senha(frase, () => {
        if (!chato) return;
        chato = false;
        setDevice('boringMode', undefined);
        document.body.classList.remove('chato');
        render();
        ficha.rejoga();
      });
  })();
  // uma seção só anima quando chega na tela; a fila cuida da ordem de cima pra baixo
  let olhoSec = null;
  function armaOlho() {
    if (!('IntersectionObserver' in window)) {
      anim.naTela = { mine: true, itens: true, settle: true };
      return;
    }
    if (olhoSec) olhoSec.disconnect();
    olhoSec = new IntersectionObserver(
      (es) => {
        let mudou = false;
        for (const e of es) {
          if (!e.isIntersecting) continue;
          const k = { mine: 'mine', itemsSec: 'itens', settle: 'settle' }[e.target.id];
          if (k && !anim.naTela[k]) {
            anim.naTela[k] = true;
            mudou = true;
          }
          if (olhoSec) olhoSec.unobserve(e.target);
        }
        if (mudou) render();
      },
      { threshold: 0.08 },
    );
    for (const id of ['#mine', '#itemsSec', '#settle']) olhoSec.observe($(id));
  }
  /** nota nova (outro evento, outra pessoa): tudo volta pra fila e espera a tela de novo */
  function rearmaAnims() {
    anim.cutucas.forEach(clearTimeout);
    anim = novaNota();
    const ih = $('#itemsHead');
    ih.classList.remove('pisca', 'suave');
    delete ih.dataset.pisca;
    ih.style.removeProperty('--ad');
    armaOlho();
  }
  armaOlho();
  let tt;
  function toast(msg, ms = 3500, cls = '') {
    const t = $('#toast');
    t.textContent = msg;
    // tira a classe e mede antes de pôr de novo: aviso em cima de aviso recomeça a subida
    t.className = 'toast';
    void t.offsetWidth;
    t.className = 'toast show' + (cls ? ' ' + cls : '');
    clearTimeout(tt);
    tt = setTimeout(() => t.classList.replace('show', 'sai'), ms);
  }

  // #endregion
  // #region código de barras
  // ---------- código de barras (Code 128 C) ----------
  function code128Widths(digits) {
    const P =
      '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232'.split(
        ' ',
      );
    const codes = [105];
    for (let i = 0; i < digits.length; i += 2) codes.push(+digits.slice(i, i + 2));
    codes.push(codes.reduce((a, c, i) => a + c * (i || 1), 0) % 103);
    return codes.map((c) => P[c]).join('') + '2331112';
  }
  (function barcode() {
    const widths = code128Widths('420420420420');
    let x = 0,
      rects = '';
    for (let i = 0; i < widths.length; i++) {
      const w = +widths[i];
      if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="40"/>`;
      x += w;
    }
    $('#bars').innerHTML =
      `<svg viewBox="0 0 ${x} 40" preserveAspectRatio="none" fill="#222" aria-hidden="true">${rects}</svg>`;
  })();

  // #endregion
  // #region QR
  // ---------- QR (modo byte, correção M, versões 1 a 6) ----------
  // escrito à mão como o code128Widths e o crc16: sai uma matriz de sim/não, e quem desenha
  // é a página (qrSvg) ou a comanda (fillRect). A versão 6 leva 106 bytes, o bastante pro link
  // do evento. O copia e cola do pix (~150 bytes) vai pedir as versões 7 a 9: bits de versão,
  // alinhamento em grade e blocos de tamanhos diferentes.
  // [blocos, bytes de dados por bloco, bytes de correção por bloco], da versão 1 à 6, correção M
  const QR_BLOCOS = [
    [1, 16, 10],
    [1, 28, 16],
    [1, 44, 26],
    [2, 32, 18],
    [2, 43, 24],
    [4, 27, 16],
  ];
  /** a matriz do QR, linha a linha (true é módulo preto), sem a borda branca; null se o texto passa de 106 bytes
   * @param {string} texto @returns {boolean[][] | null} */
  function qrMatriz(texto) {
    const bytes = [...new TextEncoder().encode(texto)];
    const v = QR_BLOCOS.findIndex(([b, d]) => 12 + 8 * bytes.length <= b * d * 8) + 1;
    if (!v) return null;
    const [nb, nd, ne] = QR_BLOCOS[v - 1],
      cabe = nb * nd * 8;
    // modo byte (0100), o tamanho em 8 bits, os bytes, até 4 zeros de fim e o byte completado com zero
    let bits = '0100' + [bytes.length, ...bytes].map((b) => b.toString(2).padStart(8, '0')).join('');
    bits += '0000'.slice(0, cabe - bits.length);
    bits += '0'.repeat((8 - (bits.length % 8)) % 8);
    const dados = bits.match(/.{8}/g).map((b) => parseInt(b, 2));
    for (let i = 0; dados.length < nb * nd; i++) dados.push(i % 2 ? 0x11 : 0xec); // enchimento: 0xEC, 0x11, 0xEC…
    // Reed-Solomon no corpo de 256 do QR (x⁸+x⁴+x³+x²+1); o gerador é (x-α⁰)…(x-α^(ne-1))
    const exp = [],
      log = [];
    for (let i = 0, x = 1; i < 255; i++, x = (x << 1) ^ (x & 0x80 ? 0x11d : 0)) {
      exp[i] = x;
      log[x] = i;
    }
    const vezes = (a, b) => (a && b ? exp[(log[a] + log[b]) % 255] : 0);
    let gerador = [1];
    for (let i = 0; i < ne; i++) gerador = [...gerador, 0].map((c, j) => c ^ (j ? vezes(gerador[j - 1], exp[i]) : 0));
    const blocos = [...Array(nb)].map((_, i) => dados.slice(i * nd, (i + 1) * nd));
    const correcoes = blocos.map((bloco) => {
      const resto = Array(ne).fill(0);
      for (const b of bloco) {
        const f = b ^ /** @type {number} */ (resto.shift());
        resto.push(0);
        for (let i = 0; i < ne; i++) resto[i] ^= vezes(gerador[i + 1], f);
      }
      return resto;
    });
    // os blocos se intercalam byte a byte: primeiro os dados, depois a correção
    const palavras = [];
    for (let i = 0; i < nd; i++) for (const b of blocos) palavras.push(b[i]);
    for (let i = 0; i < ne; i++) for (const c of correcoes) palavras.push(c[i]);

    const n = 17 + 4 * v;
    const m = [...Array(n)].map(() => Array(n).fill(false)),
      fixo = [...Array(n)].map(() => Array(n).fill(false));
    const poe = (x, y, preto) => {
      m[y][x] = preto;
      fixo[y][x] = true;
    };
    // os três quadrados dos cantos, já com a faixa branca em volta
    for (const [cx, cy] of [
      [3, 3],
      [n - 4, 3],
      [3, n - 4],
    ])
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          if (cx + dx >= 0 && cx + dx < n && cy + dy >= 0 && cy + dy < n) poe(cx + dx, cy + dy, d !== 2 && d !== 4);
        }
    // o pontilhado entre os cantos, o quadradinho de alinhamento (um só até a versão 6) e o módulo preto fixo
    for (let i = 8; i < n - 8; i++) {
      poe(i, 6, i % 2 === 0);
      poe(6, i, i % 2 === 0);
    }
    if (v > 1)
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) poe(n - 7 + dx, n - 7 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    poe(8, n - 8, true);
    // o formato (correção e máscara) mora em volta dos cantos, em duas cópias
    /** @param {number} formato os 15 bits, já com o BCH e o xor */
    const poeFormato = (formato) => {
      const bit = (i) => ((formato >> i) & 1) === 1;
      for (let i = 0; i < 6; i++) poe(8, i, bit(i));
      poe(8, 7, bit(6));
      poe(8, 8, bit(7));
      poe(7, 8, bit(8));
      for (let i = 9; i < 15; i++) poe(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) poe(n - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) poe(8, n - 15 + i, bit(i));
    };
    poeFormato(0); // reserva o lugar antes dos dados
    // os dados sobem e descem em colunas de duas, da direita pra esquerda, pulando a coluna 6
    let k = 0;
    for (let dir = n - 1; dir >= 1; dir -= 2) {
      if (dir === 6) dir = 5;
      for (let i = 0; i < n; i++)
        for (const x of [dir, dir - 1]) {
          const y = (dir + 1) & 2 ? i : n - 1 - i;
          if (fixo[y][x]) continue;
          m[y][x] = k < palavras.length * 8 && ((palavras[k >> 3] >> (7 - (k & 7))) & 1) === 1;
          k++;
        }
    }
    // das 8 máscaras fica a que dá menos penalidade (blocos, faixas e falsos cantos que confundem o leitor)
    const MASCARAS = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    const dado = fixo.map((l) => [...l]),
      base = m.map((l) => [...l]);
    let melhor = null,
      menor = Infinity;
    MASCARAS.forEach((mascara, qual) => {
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) m[y][x] = dado[y][x] ? base[y][x] : base[y][x] !== mascara(x, y);
      // correção M é 00; os 10 bits de BCH saem do resto por 0x537
      let r = qual;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >> 9) * 0x537);
      poeFormato(((qual << 10) | r) ^ 0x5412);
      const linhas = m.map((l) => l.map(Number).join('')),
        colunas = m.map((_, x) => m.map((l) => +l[x]).join(''));
      let pena = 0,
        pretos = 0;
      for (const s of [...linhas, ...colunas]) {
        for (const run of s.match(/0+|1+/g) || []) if (run.length >= 5) pena += run.length - 2;
        // a borda branca conta como claro: falso canto encostado na beira também confunde
        pena += 40 * (('0000' + s + '0000').match(/(?=10111010000|00001011101)/g) || []).length;
      }
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          pretos += +m[y][x];
          if (x && y && m[y][x] === m[y - 1][x] && m[y][x] === m[y][x - 1] && m[y][x] === m[y - 1][x - 1]) pena += 3;
        }
      pena += 10 * Math.floor(Math.abs((pretos * 100) / (n * n) - 50) / 5);
      if (pena < menor) [menor, melhor] = [pena, m.map((l) => [...l])];
    });
    return melhor;
  }
  /** o QR em SVG, com a borda branca de 4 módulos que o leitor precisa @param {string} texto */
  const qrSvg = (texto) => {
    const m = qrMatriz(texto);
    if (!m) return '';
    let d = '';
    m.forEach((l, y) => l.forEach((preto, x) => preto && (d += `M${x} ${y}h1v1h-1z`)));
    const t = m.length + 8;
    return `<svg viewBox="-4 -4 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="QR do link"><rect x="-4" y="-4" width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#222"/></svg>`;
  };

  // #endregion
  // #region início
  // ---------- início ----------
  // colar outro link de evento na mesma aba: mudar a query já recarrega a página sozinho
  atualizaBolinha();
  (async () => {
    // ?senha= é o nome antigo do parâmetro: link velho no zap continua abrindo
    const q = new URLSearchParams(location.search);
    const c = q.get('evento') || q.get('senha');
    const quem = q.get('quem');
    if (quem && /^[a-z0-9]{1,32}$/.test(quem)) quemDoLink = quem;
    // o nome digitado no cartão de um evento aberto: o endereço já sai do ?novo=, e recarregar não cria mais um
    const novo = (q.get('novo') || '').trim().toLowerCase();
    if (novo) {
      history.replaceState(null, '', location.pathname);
      try {
        return await enterRoom(novo, true);
      } catch (e) {
        return showGate(e.message);
      }
    }
    if (c) {
      const code = c.trim().toLowerCase(),
        id = await sha(code);
      // o endereço sempre carrega o código: recarregar um evento que o aparelho conhece não é entrar de novo
      // (e, se ele sumiu do banco, cai no "Sumiu!" com a cópia, não no "Criar …?")
      if (DB && gaveta(roomKey(id)).code === code) return openGroup(code, id);
      try {
        return await enterRoom(code);
      } catch (e) {
        return showGate(e.message);
      }
    }
    showGate();
  })();
  // #endregion
})();
