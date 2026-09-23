// @ts-check
/** @typedef {{ id: string, name: string, at: number }} Person */
/** @typedef {{ id: string, desc: string, amount: number, payer: string, among: string[], at: number, kind?: 'payment', by?: string, shares?: Record<string, number> }} Expense */
/** @typedef {{ v: 2, name: string, updatedAt: number, people: Person[], expenses: Expense[], deleted: string[] }} Room */
/** @typedef {{ from: string, to: string, cents: number }} Transfer */
(() => {
  // ---------- config ----------
  // Firebase Realtime Database (REST). Ex.: 'https://racha-xxxxx-default-rtdb.firebaseio.com'
  const DB = 'https://racha-77bc7-default-rtdb.firebaseio.com';
  const POLL_MS = 6000;
  const COBRAR = false; // botão 'cobrar' no acerto, desligado por enquanto
  const DESFAZER = true; // link pra remover um pagamento, útil pra testar
  const MEMBROS = false;     // lista de gente no rodapé; desligada pra ver como fica sem
  const PAGOS_NA_LISTA = 3;  // quitações que ficam à vista no Falta pagar; o resto some pra não poluir
  const CURRENCY = 'R$';

  /** @returns {any} */
  const $ = s => document.querySelector(s);
  /** @returns {HTMLInputElement[]} */
  const inputs = s => /** @type {HTMLInputElement[]} */ ([...document.querySelectorAll(s)]);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: k => { try { localStorage.removeItem(k); } catch {} } };

  /** @type {string|null} */ let groupId = null; let roomName = '';
  /** @type {Room|null} */ let state = null;
  /** @type {string|null} */ let me = null;
  let pollTimer = null, saving = false;

  /** @returns {Room} */
  const fresh = (name = '') => ({ v:2, name, updatedAt: Date.now(), people:[], expenses:[], deleted:[] });
  const cacheKey = () => `racha:${groupId}`;
  const cacheSave = () => ls.set(cacheKey(), JSON.stringify(state));
  const cacheLoad = () => { try { return clean(JSON.parse(ls.get(cacheKey()))); } catch { return null; } };
  const meKey = () => `racha:${groupId}:me`;

  // ---------- merge (união por id; exclusões vencem) ----------
  // dados do banco/cache são de terceiros: só ids [a-z0-9] entram em atributos HTML, tudo o mais vira string curta ou número
  const okId = id => typeof id === 'string' && /^[a-z0-9]{1,32}$/.test(id);
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  /** @param {any} d @returns {Room|null} */
  function clean(d){
    if (!d || typeof d !== 'object') return null;
    const people = (Array.isArray(d.people) ? d.people : []).filter(p => p && okId(p.id) && str(p.name, 30).trim()).map(p => ({ id: p.id, name: str(p.name, 30), at: +p.at || 0 }));
    const expenses = (Array.isArray(d.expenses) ? d.expenses : []).filter(e => e && okId(e.id) && okId(e.payer) && Array.isArray(e.among) && e.among.length && e.among.every(okId) && Number.isFinite(+e.amount)).map(e => {
      const o = { id: e.id, desc: str(e.desc, 60), amount: Math.round(+e.amount*100)/100, payer: e.payer, among: e.among.slice(0, 50), at: +e.at || 0 };
      if (e.kind === 'payment') o.kind = 'payment'; if (typeof e.by === 'string') o.by = e.by.slice(0, 30);
      if (e.shares && typeof e.shares === 'object') { o.shares = {}; for (const id of o.among) o.shares[id] = Math.max(0, Math.round(+e.shares[id] || 0)); }
      return o; });
    return { v:2, name: str(d.name, 40), updatedAt: +d.updatedAt || 0, people, expenses, deleted: (Array.isArray(d.deleted) ? d.deleted : []).filter(okId) };
  }
  // Firebase devolve chaves em ordem alfabética; compara sem depender da ordem
  const canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(x => [x, v[x]])) : v);
  /** @param {Room|null} a @param {Room|null} b @returns {Room|null} */
  function merge(a, b){
    a = clean(a); b = clean(b);
    if (!a) return b; if (!b) return a;
    const deleted = new Set([...(a.deleted||[]), ...(b.deleted||[])]);
    const byId = list => { const m = new Map(); for (const x of list||[]) if (!deleted.has(x.id)) m.set(x.id, x); return m; };
    const people = new Map([...byId(a.people), ...byId(b.people)]);
    const expenses = new Map([...byId(a.expenses), ...byId(b.expenses)]);
    return { v:2, name: a.name || b.name || '', updatedAt: Math.max(a.updatedAt||0, b.updatedAt||0),
      people:[...people.values()].sort((x,y)=>(x.at||0)-(y.at||0)),
      expenses:[...expenses.values()].sort((x,y)=>x.at-y.at),
      deleted:[...deleted].slice(-500) };
  }

  // ---------- remoto ----------
  const setStatus = (msg, err) => { const el = $('#status'); el.textContent = msg; el.classList.toggle('err', !!err); };
  const roomUrl = id => `${DB}/rooms/${id}.json`;
  async function apiGet(id){
    const r = await fetch(roomUrl(id), { cache:'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data === null) throw Object.assign(new Error('não encontrado'), { notFound:true });
    return data;
  }
  async function apiPut(id, data){
    const r = await fetch(roomUrl(id), { method:'PUT', body: JSON.stringify(data) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  }

  async function sync(){            // baixa, mescla e sobe se houver novidade
    if (!groupId || saving) return;
    saving = true;
    try {
      const remote = await apiGet(groupId);
      const merged = merge(state, remote);
      const changed = canon(merged) !== canon(remote);
      state = merged; cacheSave(); render();
      if (changed) await apiPut(groupId, state);
      setStatus('Sincronizado ' + new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}));
    } catch (e) {
      if (e.notFound) return showLost();
      setStatus('Offline · ' + e.message, true);
    } finally { saving = false; }
  }
  function commit(){ state.updatedAt = Date.now(); cacheSave(); render(); sync(); }
  let tick = 0;
  function startPolling(){ clearInterval(pollTimer); pollTimer = setInterval(() => { if (!document.hidden) { sync(); if (++tick % 5 === 0) loadPixKeys(); } }, POLL_MS); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });

  // ---------- contas ----------
  function shares(cents, ids){ const base = Math.floor(cents/ids.length), rem = cents - base*ids.length; const o={}; ids.forEach((id,i)=>o[id]=base+(i<rem?1:0)); return o; }
  const shareOf = (e, ids) => { if (e.shares) { const o = {}; for (const id of ids) o[id] = e.shares[id] || 0; return o; } return shares(Math.round(e.amount*100), ids); };
  const howText = (e, name = nameOf, html = false) => { const loan = !e.among.includes(e.payer);
    if (e.shares) return e.among.map(id => `${name(id)} ${fmt((e.shares[id]||0)/100)}`).join(', ');
    if (loan) return `${e.among.map(name).join(', ')} deve${e.among.length===1?'':'m'} tudo`;
    if (!html) return `÷${e.among.length}`;
    return `<a class="link" data-among="${e.id}" title="ver quem">÷${e.among.length}</a><span class="who"> (${e.among.map(name).join(', ')})</span>`; };
  /** @returns {Record<string, number>} saldo em centavos por pessoa (positivo = a receber) */
  function balances(){
    /** @type {Record<string, number>} */ const b = {}; state.people.forEach(p => b[p.id] = 0);
    for (const e of state.expenses) {
      const ids = e.among.filter(id => id in b); if (!ids.length || !(e.payer in b)) continue;
      const cents = Math.round(e.amount*100); b[e.payer] += cents; const sh = shareOf(e, ids); for (const id of ids) b[id] -= sh[id];
    }
    return b;
  }
  /** @param {Record<string, number>} b @returns {Transfer[]} */
  function settlements(b){
    const d=[], c=[]; for (const [id,v] of Object.entries(b)) { if (v<0) d.push({id,c:-v}); else if (v>0) c.push({id,c:v}); }
    d.sort((x,y)=>y.c-x.c); c.sort((x,y)=>y.c-x.c); const out=[]; let i=0,j=0;
    while (i<d.length && j<c.length) { const a=Math.min(d[i].c,c[j].c); out.push({from:d[i].id,to:c[j].id,cents:a}); d[i].c-=a; c[j].c-=a; if(!d[i].c)i++; if(!c[j].c)j++; }
    return out;
  }

  // ---------- render ----------
  const PALETTE = ['#8a5345','#45838a','#531c8a','#b25993','#001bb2','#2472b2','#b224b2','#4c3b75','#751742','#0050b2']; // matizes afastados entre si e longe do vermelho/verde (deve/recebe) e do âmbar dos botões
  const MARK = ['#f7dad2','#d2f4f7','#dabcf7','#f7d2ea','#adb8f7','#bcddf7','#f7bcf7','#ddd3f7','#f7bcd7','#adcef7']; // marca-texto da tela: os mesmos tons, clarinhos, na mesma ordem
  // no recibo em png o papel é mais escuro e o zap ainda comprime: os tons claros da tela sumiam
  // no fundo (o de Fernando ficava a 10 de distância dele). Mesmos matizes, bem mais firmes.
  const MARKR = ['#eb8d75','#75dfeb','#b075eb','#eb75c2','#7587eb','#75b6eb','#eb75eb','#9875eb','#eb75ab','#75aaeb'];
  const idx = id => Math.max(0, state.people.findIndex(p => p.id === id));
  const colorOf = id => PALETTE[idx(id) % PALETTE.length];
  const markOf = id => MARK[idx(id) % MARK.length];
  const markForte = id => MARKR[idx(id) % MARKR.length];   // o mesmo tom, firme: recibo em png e a volta da caneta
  const nm = id => `<span class="nm" style="color:${colorOf(id)}">${esc(nameOf(id))}</span>`;
  const nmByName = name => { const p = state.people.find(q => q.name === name); return p ? nm(p.id) : esc(name); };
  const nmList = ids => ids.map(nm).join(', ');
  let showAll = false, itemsOpen = false; const openItems = new Set();
  // carimbo: ângulo fixo por pagamento (não pula entre renders); o risco da linha corre
  // uma vez só por pagamento — o #settle é refeito a cada render e, por tempo, um
  // render no meio do caminho recomeçava a animação do zero
  // quando cada pagamento apareceu na tela; 0 = já estava pago quando a página abriu
  const vistos = new Map();        // pagamento -> quando o risco dele deve começar (pode ser no futuro)
  const RISCO_MS = 550, RISCO_GAP = 130;
  let settleT = 0, riscoT = 0;     // hora marcada pras voltas do círculo e pros riscos
  // a caneta é rápida, mas não escreve dois traços ao mesmo tempo: cada volta começa
  // quando a anterior fecha, dentro da linha e de uma linha pra outra
  const DESENHA_MS = 180, DESENHA_GAP = 180, VOLTA_GAP = 360;
  let seguraRisco = false;   // quitação acabou de sair: espera o cartão de 'quitado!' fechar
  // nada anima fora da tela, e cada bloco entra na fila atrás do de cima: a nota se
  // preenche de cima pra baixo, na ordem em que a pessoa leria
  let mineNaTela = false, itensNaTela = false, settleNaTela = false, filaT = 0;
  let itensT = 0; const APERTO_MS = 620, APERTO_LEAD = 300;   // um toquinho e meio: me aperta
  const agenda = dur => { const t = Math.max(Date.now(), filaT); filaT = t + dur; return t; };
  const hash32 = txt => { let h = 2166136261; for (const ch of txt) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h ^ (h >>> 15)) >>> 0; };
  const stampStyle = id => { const h = hash32(id);
    const rot = (h % 15) - 10, dy = ((h >>> 8) % 5) - 2;
    // com um cartão por cima a animação acabava escondida e a pessoa só via o resultado.
    // uma quitação recém-feita entra na hora; as da carga inicial saem do riscoT, em cascata
    // só entra aqui uma quitação feita agora: as da carga inicial são carimbadas em
    // bloco quando o #settle pega a vez na fila. Sem o riscoT, o primeiro render
    // marcava todas com a hora de agora e elas riscavam antes de tudo, fora de ordem.
    if (!vistos.has(id) && riscoT && !seguraRisco && $('#overlay').classList.contains('hidden'))
      vistos.set(id, Date.now());
    // o #settle é refeito a cada render: sem o atraso, um render no meio do caminho
    // recomeçaria o risco do zero. Positivo = ainda vai começar, negativo = retoma.
    const t = vistos.get(id), dt = t === undefined ? Infinity : Date.now() - t;
    return { cls: dt < RISCO_MS ? ' novo' : '', css: `--rot:${rot}deg;--dy:${dy}px`,
             rd: dt < RISCO_MS ? `--rd:${-dt}ms` : '' }; };
  /** traço de marca-texto feito à mão: ângulo, altura e pontas tortas, fixos por linha */
  const markStyle = (seed, color) => { const h = hash32(seed), g = (bit, min, span) => min + ((h >>> bit) & 15) / 15 * span;
    return `--mk:${color};--mka:${g(0, 177.8, 1.2).toFixed(1)}deg;--mkb:${g(4, 181, 1.2).toFixed(1)}deg;`
      + `--mkt:${g(8, 17, 5).toFixed(0)}%;--mke:${g(12, 78, 5).toFixed(0)}%;--mku:${g(16, 22, 5).toFixed(0)}%;--mkf:${g(20, 73, 5).toFixed(0)}%;`
      + `--mkw:${g(24, 95, 5).toFixed(0)}%;--mkv:${g(2, 92, 6).toFixed(0)}%;--mkx:${g(6, 0, 4).toFixed(0)}%;--mky:${g(10, 2, 6).toFixed(0)}%;--mkz:${g(14, -2, 4).toFixed(0)}px`; };
  let lastSeen = 0; const seenKey = () => `racha:${groupId}:seen`;
  const markSeen = () => { if (groupId) ls.set(seenKey(), String(Date.now())); };
  window.addEventListener('pagehide', markSeen); document.addEventListener('visibilitychange', () => { if (document.hidden) markSeen(); });
  // ---------- pix ----------
  const COPY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const KEY_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12.65 10A6 6 0 0 0 1 12a6 6 0 0 0 11.65 2H18v3h4v-7h-9.35zM7 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>';
  const OK_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 15-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8z"/></svg>';
  const NO_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 13.6L15.6 17 12 13.4 8.4 17 7 15.6l3.6-3.6L7 8.4 8.4 7l3.6 3.6L15.6 7 17 8.4 13.4 12z"/></svg>';
  const PIX_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M11.917 11.71a2.046 2.046 0 0 1-1.454-.602l-2.1-2.1a.4.4 0 0 0-.551 0l-2.108 2.108a2.044 2.044 0 0 1-1.454.602h-.414l2.66 2.66c.83.83 2.177.83 3.007 0l2.667-2.668h-.253zM4.25 4.282c.55 0 1.066.214 1.454.602l2.108 2.108a.39.39 0 0 0 .552 0l2.1-2.1a2.044 2.044 0 0 1 1.453-.602h.253L9.503 1.623a2.127 2.127 0 0 0-3.007 0l-2.66 2.66h.414zM14.377 6.496l-1.612-1.612a.307.307 0 0 1-.114.023h-.733c-.379 0-.75.154-1.017.422l-2.1 2.1a1.005 1.005 0 0 1-1.425 0L5.268 5.32a1.448 1.448 0 0 0-1.018-.422h-.9a.306.306 0 0 1-.109-.021L1.623 6.496c-.83.83-.83 2.177 0 3.008l1.618 1.618a.305.305 0 0 1 .108-.022h.901c.38 0 .75-.153 1.018-.421L7.375 8.57a1.034 1.034 0 0 1 1.426 0l2.1 2.1c.267.268.638.421 1.017.421h.733c.04 0 .079.01.114.024l1.612-1.612c.83-.83.83-2.178 0-3.008z"/></svg>';
  let pixKeys = {}, pixReady = false; // personId -> chave (lida do banco); pixReady = já consultou uma vez
  const pixVisto = new Map();   // pessoa -> quando as animações da linha dela começam
  let mineT = 0;                // hora marcada pra Minha conta (0 = ainda não entrou na fila)
  const PIX_MS = 420, PISCA_MS = 900, PISCA_GAP = 320;   // uma piscada só, devagar
  const PISCA_LEAD = 420;   // o quanto a fila reserva além da última piscada começar
  const pixTokKey = pid => `racha:${groupId}:pixtok:${pid}`;
  const pixUrl = (pid, child = '') => `${DB}/pix/${groupId}/${pid}${child}.json`;
  async function loadPixKeys(){
    const out = {};
    await Promise.all(state.people.map(async p => { try { const r = await fetch(pixUrl(p.id, '/key'), { cache:'no-store' }); if (r.ok) { const v = await r.json(); const k = typeof v === 'string' ? validPixKey(v) : null; if (k) out[p.id] = k; } } catch {} }));
    const changed = JSON.stringify(out) !== JSON.stringify(pixKeys) || !pixReady; pixKeys = out; pixReady = true; if (changed) render();
  }
  function validPixKey(k){
    k = k.trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return k.toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(k) && /^[\x20-\x7e]+$/.test(k)) return k.toLowerCase();
    return null;
  }
  async function savePix(){
    if (!me) return showWho();
    const k = await askText('Chave Pix', 'só chave aleatória ou e-mail. CPF e telefone não.', 'chave aleatória ou e-mail', pixKeys[me] || '', 'salvar');
    if (k === null) return;
    const key = validPixKey(k); if (!key) return toast('Só chave aleatória ou e-mail');
    await putPix(me, key);
  }
  async function putPix(pid, key){
    let tok = ls.get(pixTokKey(pid)); if (!tok) { tok = uid() + uid() + uid() + uid(); ls.set(pixTokKey(pid), tok); }
    try {
      const r = await fetch(pixUrl(pid), { method:'PUT', body: JSON.stringify({ key, tok }) });
      if (r.status === 401 || r.status === 403) return toast('Sem permissão: essa chave foi cadastrada em outro aparelho (ou as regras do banco não foram atualizadas)');
      if (!r.ok) return toast('Erro ao salvar: HTTP ' + r.status);
      pixKeys[pid] = key; render(); toast('Chave Pix salva');
    } catch (e) { toast('Erro ao salvar: ' + e.message); }
  }
  // Pix copia e cola (BR Code EMV) com valor
  function crc16(str){ let crc = 0xFFFF; for (let i = 0; i < str.length; i++) { crc ^= str.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) { crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1); crc &= 0xFFFF; } } return crc.toString(16).toUpperCase().padStart(4, '0'); }
  const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
  function pixCode(key, name, cents){
    const nm = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().slice(0, 25) || 'RECEBEDOR';
    const p = tlv('00', '01') + tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key)) + tlv('52', '0000') + tlv('53', '986') + tlv('54', (cents/100).toFixed(2)) + tlv('58', 'BR') + tlv('59', nm) + tlv('60', 'BRASIL') + tlv('62', tlv('05', '***')) + '6304';
    return p + crc16(p);
  }
  // no teclado do celular o separador é vírgula; aceita 12,50 e 1.234,56 além de 12.50
  const numVal = v => { let s = String(v).trim().replace(/\s/g, ''); if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return parseFloat(s); };
  const fmt = n => { const [i, d] = Math.abs(n).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
  const money = n => `${CURRENCY}\u00a0${fmt(n)}`;
  const val = n => `<span class="cur">${CURRENCY}</span><span class="num">${fmt(n)}</span>`;
  const nameOf = id => (state.people.find(p => p.id === id) || {name:'?'}).name;
  const listNames = ids => ids.map(nameOf).map(esc).join(', ');
  // frases de boteco: sorteadas uma vez por abertura, escolhidas pelo estado da conta
  const SIGNOFF = {
    owe: ['Paga logo, meu bem.', 'Fiado só amanhã, meu amor.', 'Não aceito cheque, viu?', 'A conta não se paga sozinha, meu anjo.', 'Bebeu, pagou, minha flor.'],
    owed: ['Cobra sem dó, meu bem.', 'Quem deve, deve, meu anjo.', 'Juros só na amizade, viu?', 'Fiado é confiança, meu amor.'],
    even: ['Tudo certo, volte sempre, meu bem!', 'Casa limpa, meu amor.', 'Valeu, meu bem!', 'Deus te pague, minha flor.'],
    all: ['Casa fechada, todo mundo quite. Benção!', 'Ninguém deve nada. Milagre, meu anjo.', 'Zerou. Bora abrir outra, meu bem?'],
    none: ['Valeu, meu bem!', 'Volte sempre, minha flor!', 'Um beijo, benção.', 'Aberto até o último pagar, viu?'],
  };
  const luck = Math.random();
  const pick = list => list[Math.floor(luck * list.length)];
  function render(){
    if (!state) return;
    $('#roomLabel').textContent = roomName || '—';
    document.title = roomName ? `${roomName} · Tô Lisa` : 'Tô Lisa · quem me deve?';
    $('#roomLabel').onclick = showRoom;
    // só reescreve quando muda: refazer o nó a cada sync reiniciava o balancinho do botão
    { const wl = $('#whoLine');
      const html = me && state.people.some(p => p.id === me) ? `Sou <a class="link" id="whoBtn" style="color:${colorOf(me)}">${esc(nameOf(me))}</a>` : `<a class="link amb" id="whoBtn">Quem é você?</a>`;
      if (wl.dataset.k !== html) { wl.innerHTML = html; wl.dataset.k = html; }
      // evento sem ninguém começa pela lista de gente; com gente, é só dizer qual você é
      $('#whoBtn').onclick = () => state.people.length ? showWho() : showSetup(); }
    const hasMe = me && state.people.some(p => p.id === me);
    { const bal = hasMe ? (balances()[me] || 0) : 0; const allEven = state.people.length > 0 && Object.values(balances()).every(v => v === 0) && state.expenses.length > 0;
      if ($('#tagline')) $('#tagline').textContent = !hasMe || bal > 0 ? 'quem me deve?' : bal < 0 ? 'pra quem eu devo?' : 'mas não devo a ninguém 🙏';
      if ($('#signoff')) $('#signoff').textContent = pick(allEven ? SIGNOFF.all : !hasMe ? SIGNOFF.none : bal < 0 ? SIGNOFF.owe : bal > 0 ? SIGNOFF.owed : SIGNOFF.even); }
    // evento sem nada anotado: Minha conta e Itens só teriam zeros, então somem
    const vazio = state.expenses.length === 0;
    if (hasMe && !vazio) { const bal = balances()[me] || 0; const ln = (l, v, cls='') => `<div class="row ${cls}"><span class="l">${l}</span><span class="d"></span><span class="v">${v}</span></div>`;
      $('#mine').classList.remove('hidden');
      const stMe = settlements(balances());
      // quando a chave do pix chega, o botão de copiar brota de trás do ✔ e o ✔ pisca
      // verde duas vezes, um "me pague". As duas saem da mesma hora, guardada uma vez
      // por pessoa; como o #mineRows é refeito a cada poll, o atraso (negativo depois
      // que a animação começou) retoma de onde estava em vez de recomeçar no meio
      // hora marcada pras animações da seção: o copiar pix brotando de trás do ✔ e a
      // piscada verde do próprio ✔. Só entra na fila quando Minha conta está na tela
      // Minha conta pega a vez assim que aparece, sem esperar a chave do pix: senão o
      // #settle, que já estava na tela, tomava a frente. A fila só reserva o tempo das
      // piscadas, e curto: quem vem depois não precisa esperar tudo acabar
      const meus = bal < 0 ? stMe.filter(t => t.from === me) : [];
      // sem linha nenhuma não há o que reservar: quem vem depois não espera à toa
      if (mineNaTela && !mineT) mineT = agenda(meus.length ? (meus.length - 1) * PISCA_GAP + PISCA_LEAD : 0);
      // o copiar pix corre por fora da fila: brota assim que a chave chega do banco,
      // sem esperar as piscadas nem segurar quem vem depois. Nada de spinner: o botão
      // brotando já conta que chegou
      const pixB = t => { if (!pixReady || !pixKeys[t.to]) return '';
        if (!pixVisto.has(t.to)) pixVisto.set(t.to, Date.now());
        const dt = Date.now() - (pixVisto.get(t.to) || 0);
        const br = dt < PIX_MS ? ` brota" style="animation-delay:${-dt}ms` : '';
        return `<button class="ico${br}" data-pix="${t.to}|${t.cents}" title="copiar pix">${PIX_SVG}${COPY_SVG}</button>`; };
      // toda linha pisca, tenha chave de pix ou não: a conta é a mesma. Uma atrás da outra
      const okB = (t, i) => { const esp = i * PISCA_GAP, dt = mineT ? Date.now() - mineT : Infinity;
        const pi = dt < esp + PISCA_MS ? ` pisca" style="animation-delay:${esp - dt}ms` : '';
        return `<button class="ico ok${pi}" data-settle="${t.from}|${t.to}|${t.cents}" title="quitar">✔</button>`; };
      const who = bal > 0 ? stMe.filter(t => t.to === me).map(t => ln(nm(t.from), val(t.cents/100), 'sub')) : bal < 0 ? meus.map((t, i) => ln(`<span class="n">${nm(t.to)}</span><span class="dupla">${okB(t, i)}${pixB(t)}</span>`, `<span class="cur">R$</span><a class="link num" style="color:inherit" title="copiar valor" data-copy-value="${fmt(t.cents/100)}">${fmt(t.cents/100)}</a>`, 'sub')) : [];
      const hdr = '';
      // quite não tem conta pra mostrar: a linha de zeros vira um recado, na mesma
      // caixinha tracejada que aponta o lápis no evento novo
      $('#mineRows').innerHTML = (bal === 0 ? '<div class="empty vazio quite">tudo quite! 🎉<br><b>você não deve nada a ninguém.</b></div>'
        : ln(bal > 0 ? 'me devem' : 'eu devo', val(Math.abs(bal)/100), bal > 0 ? 'pos' : 'neg')) + hdr + who.join(''); }
    else $('#mine').classList.add('hidden');
    $('#fab').classList.toggle('hidden', !hasMe);   // anotar é de quem já disse quem é
    $('#waBtn').classList.toggle('so', !hasMe);     // sozinho o zap encosta na esquerda
    // enquanto não houver nada anotado, o balão mostra por onde se começa
    // no caderno em branco o título não tem o que apresentar; fica só a caixa
    // a ficha só entra em nota que já tem gasto; em caderno vazio ela é poluição
    { const f = $('.stain'); if (f) { const b = hasMe ? (balances()[me] || 0) : null;
        f.classList.toggle('hidden', vazio);
        f.classList.toggle('quite', b !== null && b >= 0); } }   // quem deve fica no âmbar de sempre
    $('#settleHead').classList.toggle('hidden', vazio);
    { const chama = hasMe && state.expenses.length === 0;
      $('#dica').classList.toggle('hidden', !chama);
      $('#fab').classList.add('chamando'); }   // sempre preenchido, pra ver como fica
    // nota vazia não tem o que mandar: o zap some e sobra só o "quem é você?"
    $('#waBtn').classList.toggle('hidden', vazio);
    $('#itemsSec').classList.toggle('hidden', vazio || (hasMe && (balances()[me] || 0) === 0 && state.expenses.some(e => e.kind !== 'payment')));
    // entre Minha conta e Falta pagar na página, e entre as duas na fila também. O
    // cartão do "quem é você?" segura: com ele aberto os itens já estão visíveis por
    // trás, e o toquinho furava a fila antes de Minha conta existir
    if (itensNaTela && !itensT && hasMe && $('#overlay').classList.contains('hidden')
        && !$('#itemsSec').classList.contains('hidden')) itensT = agenda(APERTO_LEAD);
    const myBal = hasMe ? (balances()[me] || 0) : 0;
    // sem spinner aqui também: a linha fica vazia e o botão desce de debaixo do título
    const pixWant = !hasMe || myBal <= 0 || pixKeys[me] || !pixReady ? '' : `<button class="ico amb" id="pixBtn">${PIX_SVG}${KEY_SVG} cadastrar chave pix</button>`;
    const pl = $('#pixLine');
    if (!pixWant) { if (pl.dataset.k && !pl.classList.contains('gone')) { pl.classList.add('gone');
      setTimeout(() => { if (pl.classList.contains('gone')) { pl.innerHTML = ''; pl.dataset.k = ''; pl.classList.remove('cheio'); } }, 450); } }
    // a altura vem num quadro depois do conteúdo, senão não há de onde a transição sair
    else { pl.classList.remove('gone'); if (pl.dataset.k !== pixWant) { pl.innerHTML = pixWant; pl.dataset.k = pixWant;
      requestAnimationFrame(() => pl.classList.add('cheio')); } }
    if ($('#pixBtn')) $('#pixBtn').onclick = savePix;
    $('#peopleSec').classList.toggle('hidden', !MEMBROS);
    $('#peopleLine').innerHTML = state.people.length ? state.people.map(p => nm(p.id)).join(', ') : 'ninguém';
    $('#addPerson').textContent = state.people.length ? ',+' : ' +';

    const payerSel = $('#payer'); const prevPayer = payerSel.value || me;
    payerSel.innerHTML = state.people.map(p => `<option value="${p.id}">${esc(p.name)} pagou</option>`).join('');
    if (state.people.some(p => p.id === prevPayer)) payerSel.value = prevPayer;

    const prev = inputs('#splitChips input');
    const known = new Set(prev.map(i => i.value)), checked = new Set(prev.filter(i => i.checked).map(i => i.value));
    $('#splitChips').innerHTML = state.people.map(p => { const on = !known.has(p.id) || checked.has(p.id);
      return `<label class="chip ${on?'on':''}"><input type="checkbox" value="${p.id}" ${on?'checked':''}>${esc(p.name)}</label>`; }).join('');
    updateHint();

    const b = balances();
    const line = (l, v, cls='', extra='', style='', vat='') => `<div class="row ${cls}"${style ? ` style="${style}"` : ''}><span class="l">${l}</span><span class="d"></span><span class="v"${vat}>${v}</span>${extra}</div>`;
    const num = c => fmt(c/100);

    const s = settlements(b);
    const pays = state.expenses.filter(e => e.kind === 'payment').slice(-PAGOS_NA_LISTA).reverse();
    // o #settle entra na fila atrás de Minha conta, e primeiro as voltas do círculo
    // (que ficam em cima), depois os riscos dos pagamentos (que ficam embaixo)
    const nMeus = s.filter(t => t.from === me).length;
    if (settleNaTela && !settleT && !seguraRisco && $('#overlay').classList.contains('hidden')) {
      settleT = agenda(nMeus ? (nMeus - 1) * VOLTA_GAP + DESENHA_GAP + DESENHA_MS : 0);
      riscoT = agenda(pays.length ? (pays.length - 1) * RISCO_GAP + RISCO_MS : 0);
      pays.forEach((e, i) => vistos.set(e.id, riscoT + i * RISCO_GAP)); }   // de cima pra baixo
    const dtS = settleT ? Date.now() - settleT : Infinity;
    const desenha = dtS < DESENHA_MS + DESENHA_GAP + Math.max(0, nMeus - 1) * VOLTA_GAP;
    let ordem = 0;   // as suas linhas riscam uma atrás da outra, de cima pra baixo
    $('#settle').innerHTML = (s.map(t => { const meu = t.from === me, o = meu ? ordem++ : 0;
      return line(`${nm(t.from)} → ${nm(t.to)}`, val(t.cents/100),
        meu ? 'mine' + (desenha ? ' risca' : '') : '', '',
        meu ? markStyle(t.from + t.to, markForte(me)) + (desenha ? `;--rd2:${o * VOLTA_GAP - dtS}ms` : '') : '',
        meu ? ` data-copy-value="${fmt(t.cents/100)}" title="copiar valor"` : '') +
        (COBRAR && t.to === me ? `<div class="small acts" style="margin:4px 0 10px;justify-content:flex-start"><button class="ico" data-cobrar="${t.from}|${t.cents}" title="cobrar pelo whatsapp">👀 cobrar</button></div>` : ''); }).join('') || (state.expenses.length ? '<div class="empty">tudo quitado 🎉</div>'
        : `<div class="empty vazio">nada anotado ainda.<br><b>${hasMe ? `toque no ${LAPIS_SVG} abaixo pra anotar o primeiro gasto.` : 'diga quem você é aí em cima pra começar.'}</b></div>`))
      + pays.map(e => { const st = stampStyle(e.id); return line(`<span class="n">${lastSeen > 0 && e.at > lastSeen && (!me || e.by !== nameOf(me)) ? '<span class="tag">novo</span>' : ''}${nm(e.payer)} → ${nm(e.among[0])}</span>${DESFAZER ? `<a class="link undo" data-undo="${e.id}" title="desfazer este pagamento">✕</a>` : ''}<span class="stampbox"><span class="stamp" style="color:${colorOf(e.payer)};${st.css}" title="pago em ${new Date(e.at).toLocaleDateString('pt-BR')}">PAGO</span></span>`, val(e.amount), 'paid' + st.cls, '', `--ri:${colorOf(e.payer)};${st.rd}`) +
        (e.by && e.by !== nameOf(e.payer) ? `<div class="small">por ${esc(e.by)}</div>` : ''); }).join('');

    const items = state.expenses.filter(e => e.kind !== 'payment');
    const all = [...items].reverse(); const list = showAll ? all : all.slice(0, 10);
    const dayOf = e => new Date(e.at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const days = new Set(all.map(dayOf)); let lastDay = null;
    $('#expenses').innerHTML = list.map(e => {
      const how = howText(e, id => nm(id), true);
      const isNew = lastSeen > 0 && e.at > lastSeen && (!me || e.by !== nameOf(me));
      let head = ''; if (days.size > 1) { const d = dayOf(e); if (d !== lastDay) { head = `<div class="day">${esc(d)}</div>`; lastDay = d; } }
      const by = e.by && e.by !== nameOf(e.payer) ? `<span class="by"> · anotado por ${nmByName(e.by)}</span>` : '';
      return head + `<div class="item ${openItems.has(e.id) ? 'open' : ''}" data-item="${e.id}">` + line(`${isNew ? '<span class="tag">novo</span>' : ''}${esc(e.desc)}`, num(Math.round(e.amount*100))) + `<div class="small"><span>${nm(e.payer)} pagou · ${how}${by}</span>${me && (e.by ? e.by === nameOf(me) : e.payer === me) ? `<button class="danger" data-del-expense="${e.id}" title="Excluir">✕</button>` : ''}</div></div>`; }).join('')
      || '<div class="empty">nada anotado ainda</div>';
    const tg = $('#toggleAll'); tg.classList.toggle('hidden', all.length <= 10); tg.textContent = showAll ? 'ver menos' : `ver todos os ${all.length} itens`;
    $('#itemsCount').textContent = `${all.length} ${all.length === 1 ? 'item' : 'itens'}`; $('#itemsCaret').classList.toggle('aberto', itemsOpen);
    // o caret é o mesmo elemento em todo render: mexer no atraso depois reiniciaria a
    // animação, então ele é marcado uma vez só e fica quieto
    { const ca = $('#itemsCaret');
      if (itensT && !ca.dataset.pisca) { ca.dataset.pisca = '1';
        ca.style.animationDelay = `${itensT - Date.now()}ms`; ca.classList.add('pisca'); } } $('#itemsBody').classList.toggle('hidden', !itemsOpen);
    $('#total').innerHTML = val(items.reduce((a, e) => a + Math.round(e.amount*100), 0) / 100);
  }
  let splitMode = 'equal';
  const customShares = () => { const o = {}; for (const i of inputs('#sharesBox input')) o[i.dataset.share] = Math.round((numVal(i.value) || 0) * 100); return o; };
  function updateHint(){
    const among = inputs('#splitChips input:checked').map(i => i.value);
    const payer = $('#payer').value; const h = $('#splitHint'); const total = Math.round((numVal($('#amount').value) || 0) * 100);
    $('#sharesBox').classList.toggle('hidden', splitMode !== 'custom');
    // o modo é a própria palavra da frase: tocar em "igualmente" vira "em partes diferentes"
    const modo = t => `<a class="link" id="modeToggle" title="trocar o jeito de dividir">${t}</a>`;
    const armaModo = () => { const m = $('#modeToggle'); if (m) m.onclick = () => { splitMode = splitMode === 'equal' ? 'custom' : 'equal'; updateHint(); }; };
    if (splitMode === 'custom') {
      const prev = customShares();
      $('#sharesBox').innerHTML = among.map(id => `<div class="row"><span class="l">${nm(id)}</span><span class="d"></span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" data-share="${id}" value="${prev[id] ? (prev[id]/100).toFixed(2) : ''}"></div>`).join('');
      h.innerHTML = `Dividido ${modo('em partes diferentes')}<span id="hintTail">${!among.length ? '.' : ' · ' + somaDasPartes()}</span>`;
      armaModo();
      return;
    }
    if (!among.length) h.textContent = 'Marque quem divide esse gasto.';
    else if (!among.includes(payer)) { h.innerHTML = `Empréstimo: ${esc(among.map(nameOf).join(', '))} deve${among.length===1?'':'m'} o valor todo a ${esc(nameOf(payer))}. Ou ${modo('em partes diferentes')}.`; armaModo(); }
    else { h.innerHTML = `Dividido ${modo('igualmente')} entre <u>${among.length} pessoa${among.length===1?'':'s'}</u>.`; armaModo(); }
  }
  /** o que ainda falta (ou sobra) pras partes fecharem o total do gasto */
  function somaDasPartes(){
    const total = Math.round((numVal($('#amount').value) || 0) * 100);
    const sum = Object.values(customShares()).reduce((a, b) => a + b, 0);
    return sum === total ? '✔' : sum < total ? `faltam ${money((total-sum)/100)}` : `sobram ${money((sum-total)/100)}`;
  }
  $('#amount').addEventListener('input', () => { if (splitMode === 'custom') updateHint(); });
  // só o rabo da frase muda enquanto se digita: refazer o hint inteiro apagaria o campo em uso
  document.addEventListener('input', ev => { const tgt = /** @type {HTMLElement} */ (ev.target);
    if (tgt.matches('#sharesBox input') && $('#hintTail')) $('#hintTail').textContent = ' · ' + somaDasPartes(); });

  // ---------- telas ----------
  let overlayCancel = null, overlaySticky = false;
  const overlay = (html, sticky = false) => { overlayCancel = null; overlaySticky = sticky; $('#overlayBox').innerHTML = html; $('#overlay').classList.remove('hidden'); };
  const closeOverlay = () => $('#overlay').classList.add('hidden');
  $('#overlay').addEventListener('click', ev => { if (ev.target.id !== 'overlay' || overlaySticky) return; const c = overlayCancel; overlayCancel = null; closeOverlay(); if (c) c(); });

  function ask(title, desc, okLabel = 'confirmar'){
    return new Promise(res => {
      overlay(`<h2 style="margin-top:0">${title}</h2>${desc ? `<p class="muted" style="margin:0 0 12px;text-align:center">${desc}</p>` : ''}<button id="okBtn" class="big">${okLabel}</button>`);
      overlayCancel = () => res(false); $('#okBtn').onclick = () => { closeOverlay(); res(true); }; $('#okBtn').focus();
    });
  }
  function askText(title, desc, placeholder, value = '', okLabel = 'confirmar'){
    return new Promise(res => {
      overlay(`<h2 style="margin-top:0">${title}</h2>${desc ? `<p class="muted" style="margin:0 0 12px;text-align:center">${desc}</p>` : ''}<form id="askForm" autocomplete="off"><input id="askInput" placeholder="${esc(placeholder)}" value="${esc(value)}"><button class="big">${okLabel}</button></form><div class="c" style="margin-top:12px"><button id="cancelBtn" class="ghost">voltar</button></div>`);
      overlayCancel = () => res(null); $('#askForm').onsubmit = ev => { ev.preventDefault(); const v = $('#askInput').value; closeOverlay(); res(v); }; $('#cancelBtn').onclick = () => { closeOverlay(); res(null); }; $('#askInput').focus();
    });
  }
  function showCopy(title, text){
    overlay(`<h2 style="margin-top:0">${title}</h2><p class="muted" style="margin:0 0 12px;text-align:center">toque e segure pra copiar</p><code class="box">${esc(text)}</code><div class="c" style="margin-top:12px"><button id="cancelBtn" class="ghost">fechar</button></div>`);
    $('#cancelBtn').onclick = closeOverlay;
  }
  function showGate(msg){
    $('#app').classList.add('loading', 'nospin');
    const intro = msg ? '' : `<div class="c" style="text-transform:none;font-size:18px;line-height:1.4;margin:6px 0 8px">tipo Splitwise, só que sem app e sem cadastro.</div>
      <div style="font-size:17px;color:var(--ink2);line-height:1.5;margin:0 auto 4px;max-width:340px">
        <div>1. anote quem pagou o quê, quando e com quem</div>
        <div>2. copie o pix e pague o deves</div>
        <div>3. cobre o amiguinho a fazer o mesmo</div>
      </div>`;
    overlay(`<h1>Tô lisa</h1>${intro}<div class="hr"></div><h2 style="margin-top:0">Evento</h2><p class="muted" style="margin:0 0 12px;text-align:center">${msg || ''}</p>
      <form id="gateForm" autocomplete="off"><input id="gateCode" placeholder="código do evento" required autofocus autocapitalize="none">
      <p id="gateErr" class="status err" style="margin:0"></p><button class="big">Abrir</button></form>`, true);
    $('#gateForm').onsubmit = async ev => {
      ev.preventDefault();
      const btn = ev.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Abrindo…';
      try { await enterRoom($('#gateCode').value.trim().toLowerCase()); }
      catch (e) { $('#gateErr').textContent = e.message; btn.disabled = false; btn.textContent = 'Abrir'; }
    };
  }
  /** primeira vez no evento: monta a lista de gente antes de perguntar quem é você */
  function showSetup(){
    const list = state.people.length
      ? state.people.map(p => `<div class="row"><span class="l">${nm(p.id)}</span><span class="d"></span><span class="v"><button class="ico" data-drop="${p.id}" title="tirar">✕</button></span></div>`).join('')
      : '<div class="empty">ninguém ainda</div>';
    overlay(`<h2 class="longo" style="margin-top:0">*** Quem tá no evento? ***</h2>
      ${list}
      <div class="hr"></div>
      <form id="setupForm" autocomplete="off" style="grid-template-columns:1fr auto;align-items:center">
        <input id="setupName" placeholder="nome" maxlength="30"><button class="small">adicionar</button></form>
      <button id="setupGo" class="big" style="margin-top:16px" ${state.people.length ? '' : 'disabled'}>Continuar</button>
      <div class="c" style="margin-top:12px"><button id="setupLeave" class="ghost" style="color:var(--red)">sair</button></div>`, true);
    $('#setupForm').onsubmit = ev => { ev.preventDefault();
      const name = $('#setupName').value.trim(); if (!name) return;
      if (state.people.some(q => q.name.toLowerCase() === name.toLowerCase())) return toast('Já existe alguém com esse nome');
      state.people.push({ id: uid(), name, at: Date.now() }); commit(); showSetup(); };
    for (const b of inputs('#overlayBox [data-drop]'))
      b.onclick = () => { state.people = state.people.filter(p => p.id !== b.dataset.drop); commit(); showSetup(); };
    $('#setupGo').onclick = () => { if (!state.people.length) return; closeOverlay(); showWho(); };
    $('#setupLeave').onclick = async () => { if (await ask('Sair do evento?', '', 'sair')) leave(); };
    $('#setupName').focus();
  }
  function showWho(){
    const opts = state.people.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    overlay(`<h2 style="margin-top:0">Quem é você?</h2>
      <form id="whoForm"><select id="whoSel"><option value="">— escolha seu nome —</option>${opts}<option value="__new">Outra pessoa (me adicionar)</option></select>
      <div id="whoNewBox" class="hidden" style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center">
        <input id="whoNew" placeholder="seu nome" maxlength="30"><button class="small">entrar</button></div></form>`);
    /** escolher já é confirmar: quem é você não tem botão de continuar */
    // trocar de pessoa é uma nota nova: o risco, as voltas do círculo e a piscada
    // do ✔ recomeçam, senão a conta do outro aparece já riscada e parada
    const entra = v => { me = v; ls.set(meKey(), me); rearmaAnims();
      closeOverlay(); render(); $('#payer').value = me; updateHint(); rejogaDiva(); };
    $('#whoSel').onchange = () => { const v = $('#whoSel').value;
      $('#whoNewBox').classList.toggle('hidden', v !== '__new');
      if (v === '__new') return $('#whoNew').focus();
      if (v) entra(v); };
    $('#whoForm').onsubmit = ev => { ev.preventDefault();
      const n = $('#whoNew').value.trim(); if (!n) return;
      if (state.people.some(q => q.name.toLowerCase() === n.toLowerCase())) return toast('Já existe alguém com esse nome');
      const p = { id: uid(), name: n, at: Date.now() }; state.people.push(p); commit(); entra(p.id); };
    $('#whoSel').focus();
  }
  function showLost(){
    clearInterval(pollTimer); $('#app').classList.add('loading', 'nospin');
    const cached = cacheLoad();
    overlay(`<h2 style="margin-top:0">Evento não encontrado</h2><p class="muted" style="margin:0 0 12px;text-align:center">esse evento não está mais no banco</p>
      ${cached ? `<button id="restoreBtn" class="big">Restaurar da minha cópia</button>` : ''}<div class="c" style="margin-top:8px"><button id="lostBack" class="ghost">voltar</button></div>`, true);
    if (cached) $('#restoreBtn').onclick = async () => { try { await apiPut(groupId, cached); location.reload(); } catch (e) { toast('Falhou: ' + e.message); } };
    $('#lostBack').onclick = leave;
  }

  // ---------- salas (código → grupo) ----------
  async function enterRoom(code){
    if (!code) throw new Error('Digite um código.');
    if (!DB) throw new Error('Armazenamento ainda não configurado (DB vazio no index.html).');
    const id = await sha(code);
    let existing = null;
    try { existing = await apiGet(id); } catch (e) { if (!e.notFound) throw new Error('Sem conexão com o banco: ' + e.message); }
    const seed = location.hash.match(/#seed=([A-Za-z0-9+/=_-]+)/);
    if (!existing) {
      if (!seed && !(await ask('Evento novo?', `não existe evento com o código "${esc(code)}". criar um agora?`, 'criar evento'))) throw new Error('confira o código');
      let data = fresh(code);
      if (seed) { try { data = { ...fresh(code), ...JSON.parse(decodeURIComponent(escape(atob(seed[1].replace(/-/g,'+').replace(/_/g,'/'))))), name: code, updatedAt: Date.now() }; } catch {} }
      await apiPut(id, data);
      if (seed) history.replaceState(null, '', location.pathname);
    }
    ls.set('racha:room', JSON.stringify({ code, id }));
    await openGroup(code, id);
  }
  async function openGroup(code, id){
    roomName = code; groupId = id; me = ls.get(meKey()); lastSeen = +ls.get(seenKey()) || 0; showAll = false;
    $('#app').classList.add('loading'); $('#app').classList.remove('nospin');
    state = cacheLoad(); if (state) render();
    closeOverlay(); setStatus('Carregando…');
    pixKeys = {}; pixReady = false; rearmaAnims();
    try { const remote = await apiGet(groupId); state = merge(state, remote); if (!state.name && code) { state.name = code; state.updatedAt = Date.now(); apiPut(groupId, state).catch(() => {}); } cacheSave(); render(); setStatus('Sincronizado'); }
    catch (e) { if (e.notFound) return showLost(); if (!state) { state = fresh(code); render(); } setStatus('Offline · ' + e.message, true); }
    $('#app').classList.remove('loading');
    // ninguém é interrompido na chegada: a tela de estreia e o "quem é você?"
    // esperam o toque no botão do cabeçalho
    startPolling(); sync(); loadPixKeys();
  }
  function showQuitado(to, amount){
    overlay(`<h2 style="margin-top:0">Quitado!</h2>
      <p class="muted" style="margin:0 0 14px;text-align:center">avise ${nm(to)} pra não cobrar de novo</p>
      <button id="waAviso" class="big">${WA_SVG} avisar no zap</button>
      <div class="c" style="margin-top:12px"><button id="quitOk" class="ghost">fechar</button></div>`);
    const fecha = () => { closeOverlay(); seguraRisco = false; render(); };   // solta o risco da linha nova
    $('#quitOk').onclick = fecha;
    overlayCancel = fecha;
    $('#waAviso').onclick = () => { window.open('https://wa.me/?text=' + encodeURIComponent(`✅ ${nameOf(to)}, te paguei ${money(amount)} do *${roomName}* 👍\n${shareUrl()}`), '_blank', 'noopener'); fecha(); };
  }
  function showRoom(){
    overlay(`<h2 style="margin-top:0">*** Evento ***</h2>
      <div class="row" style="font-size:22px"><span class="l">código</span><span class="d"></span><span class="v">${esc(roomName)}</span></div>
      <div class="row" style="font-size:17px;color:var(--ink2)"><span class="l">entra quem tem</span><span class="d"></span><span class="v">a senha</span></div>
      <div class="hr"></div>
      <div class="c"><button id="evLeave" class="ghost" style="color:var(--red)">sair do evento</button></div>`);
    $('#evLeave').onclick = async () => { if (await ask('Sair do evento?', 'só neste aparelho. você volta digitando o código.', 'sair')) leave(); };
  }
  function leave(){ ls.del('racha:room'); location.hash = ''; location.reload(); }

  // ---------- eventos ----------
  $('#addPerson').onclick = async () => { const name = ((await askText('Nova pessoa', 'quem mais tá no evento?', 'nome')) || '').trim(); if (!name) return;
    if (state.people.some(p => p.name.toLowerCase() === name.toLowerCase())) return toast('Já existe alguém com esse nome');
    state.people.push({ id: uid(), name, at: Date.now() }); commit(); };
  $('#toggleAll').onclick = () => { showAll = !showAll; render(); };
  $('#itemsHead').onclick = () => { itemsOpen = !itemsOpen; render(); };
  const openSheet = () => { $('#sheet').classList.remove('hidden'); $('#amount').focus(); };
  const closeSheet = () => $('#sheet').classList.add('hidden');
  $('#fab').onclick = () => { if (!state.people.length) return toast('Adicione pessoas primeiro'); openSheet(); };
  $('#sheetClose').onclick = closeSheet;
  $('#sheet').addEventListener('click', ev => { if (ev.target.id === 'sheet') closeSheet(); });
  $('#expenseForm').onsubmit = ev => { ev.preventDefault();
    const among = inputs('#splitChips input:checked').map(i => i.value); const amount = numVal($('#amount').value);
    if (!state.people.length) return toast('Adicione pessoas primeiro'); if (!among.length) return toast('Marque quem divide esse gasto'); if (!(amount > 0)) return toast('Valor inválido');
    const exp = { id: uid(), desc: $('#desc').value.trim(), amount: Math.round(amount*100)/100, payer: $('#payer').value, among, at: Date.now(), by: me ? nameOf(me) : undefined };
    if (splitMode === 'custom') { const sh = customShares(); const total = Math.round(amount*100); const sum = among.reduce((a, id) => a + (sh[id] || 0), 0);
      if (sum !== total) return toast(sum < total ? `Faltam ${money((total-sum)/100)} nas partes` : `Sobram ${money((sum-total)/100)} nas partes`);
      exp.shares = {}; for (const id of among) exp.shares[id] = sh[id] || 0; }
    state.expenses.push(exp);
    $('#desc').value = ''; $('#amount').value = ''; splitMode = 'equal'; itemsOpen = true; closeSheet(); commit(); toast('Anotado!'); };
  $('#payer').onchange = updateHint;
  document.addEventListener('change', ev => { const tgt = /** @type {HTMLInputElement} */ (ev.target); if (tgt.matches('#splitChips input')) { tgt.closest('.chip').classList.toggle('on', tgt.checked); updateHint(); } });
  document.addEventListener('click', async ev => {
    const tgt = /** @type {HTMLElement} */ (ev.target);
    /** @returns {HTMLElement|null} */ const near = sel => /** @type {HTMLElement|null} */ (tgt.closest(sel));
    if (!near('a,button,input,label')) { const it = near('.item'); if (it) { const id = it.dataset.item; openItems.has(id) ? openItems.delete(id) : openItems.add(id); it.classList.toggle('open'); } }
    const am = near('[data-among]');
    if (am) { const it = /** @type {HTMLElement} */ (am.closest('.item')); const id = it.dataset.item; openItems.has(id) ? openItems.delete(id) : openItems.add(id); it.classList.toggle('open'); return; }
    const px = near('[data-pix]');
    if (px) { const [to, cents] = px.dataset.pix.split('|'); const code = pixCode(pixKeys[to], nameOf(to), +cents);
      navigator.clipboard.writeText(code).then(() => toast('Pix copia e cola copiado. Cola no app do banco.'), () => showCopy('Pix copia e cola', code)); }
    const cb = near('[data-cobrar]');
    if (cb) { const [from, cents] = cb.dataset.cobrar.split('|'); const pix = me && pixKeys[me] ? `\npix: ${pixKeys[me]}` : '';
      window.open('https://wa.me/?text=' + encodeURIComponent(`👀 ${nameOf(from)}, tá faltando ${money(+cents/100)} do *${roomName}*${pix}\n${shareUrl()}`), '_blank', 'noopener'); return; }
    const un = near('[data-undo]');
    if (un) { const id = un.dataset.undo; const e = state.expenses.find(x => x.id === id); if (!e) return;
      if (!(await ask('Desfazer o pagamento?', `${nm(e.payer)} → ${nm(e.among[0])} · ${money(e.amount)}`, 'desfazer'))) return;
      state.expenses = state.expenses.filter(x => x.id !== id); state.deleted.push(id); vistos.delete(id); commit(); toast('Desfeito'); return; }
    const st = near('[data-settle]');
    if (st) { const [from, to, cents] = st.dataset.settle.split('|'); const amount = +cents/100;
      const r = st.getBoundingClientRect(), fx = r.left + r.width/2, fy = r.top + r.height/2;
      if (!(await ask('Quitar?', `${nm(from)} pagou <b style="color:var(--green)">${money(amount)}</b> pra ${nm(to)}`, 'quitei'))) return;
      state.expenses.push({ id: uid(), kind:'payment', desc:'Pagamento', amount, payer: from, among:[to], at: Date.now(), by: me ? nameOf(me) : undefined });
      seguraRisco = true; commit(); festa(fx, fy); toast('Quitado! 🎉');
      showQuitado(to, amount); }
    const cv = near('[data-copy-value]');
    if (cv) { const val = cv.dataset.copyValue; navigator.clipboard.writeText(val).then(() => toast('Valor copiado. Cola no app do banco.'), () => showCopy('Valor', val)); return; }
    const de = near('[data-del-expense]');
    if (de) { const id = de.dataset.delExpense; const e = state.expenses.find(x => x.id === id); if (!e) return;
      if (!(await ask('Excluir item?', `${esc(e.desc)} · ${money(e.amount)}`, 'excluir'))) return;
      state.expenses = state.expenses.filter(x => x.id !== id); state.deleted.push(id); commit(); }
  });
  // endereço fixo: uma cópia velha em cache não pode mandar gente pro caminho antigo
  const SITE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? location.origin + location.pathname : 'https://fernandollisboa.github.io/tolisao/';
  const shareUrl = () => `${SITE}#c=${encodeURIComponent(roomName)}`;
  $('#shareBtn').onclick = async () => { const url = shareUrl();
    try { await navigator.clipboard.writeText(url); toast('Link copiado. Quem abrir cai neste evento.'); } catch { showCopy('Link do evento', url); } };
  function joinNames(names){ return names.length <= 1 ? names.join('') : names.slice(0,-1).join(', ') + ' e ' + names[names.length-1]; }
  function summaryText(){
    const st = settlements(balances()); const ev = roomName || 'acerto';
    if (!st.length) return `🎉 tá tudo quitado no *${ev}*!\n${shareUrl()}`;
    return [`🧾 acerto do *${ev}*`, '', ...st.map(t => `💸 ${nameOf(t.from)} paga ${money(t.cents/100)} pra ${nameOf(t.to)}${pixKeys[t.to] ? ` (pix: ${pixKeys[t.to]})` : ''}`), '', `tudo aqui 👉 ${shareUrl()}`].join('\n');
  }
  // ---------- imagem da comanda (canvas) ----------
  async function renderReceipt(){
    await document.fonts.load("28px 'VT323'");
    const b = balances(), st = settlements(b);
    const items = [...state.expenses.filter(e => e.kind !== 'payment')].reverse();
    const totalCents = items.reduce((a, e) => a + Math.round(e.amount*100), 0);
    const W = 720, M = 24, P = 36, S = 2, FS = 28, LH = 34;
    const cc = document.createElement('canvas'); cc.width = W*S; cc.height = 4000*S; const x = cc.getContext('2d'); x.scale(S, S);
    x.font = `${FS}px 'VT323'`; x.textBaseline = 'alphabetic';
    const cw = x.measureText('M').width, COLS = Math.floor((W - 2*M - 2*P) / cw);
    const INK = '#2a2a2a', INK2 = '#5a5a5a', PAPER = '#efe9d8', HL = '#f7f23a';
    const mark = (col, len, color) => { x.fillStyle = color; x.fillRect(L + col*cw - 3, y - FS*0.72, len*cw + 6, FS*0.9); };
    const L = M + P; let y = M + 12 + 50;
    const up = t => String(t).toUpperCase();
    const fit = (t, n) => { t = up(t); return t.length > n ? t.slice(0, Math.max(1, n - 1)) + '…' : t; };
    const num = cents => fmt(cents/100);
    const numBig = cents => { const [i, d] = (Math.abs(cents)/100).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
    const line = (t, col = INK) => { x.fillStyle = col; x.textAlign = 'left'; x.fillText(t, L, y); y += LH; };
    const center = (t, hl) => { x.textAlign = 'center'; if (hl) { const w = x.measureText(t).width + 16; x.fillStyle = HL; x.fillRect(W/2 - w/2, y - FS*0.75, w, FS*0.95); } x.fillStyle = INK; x.fillText(t, W/2, y); y += LH; };
    const dash = () => line('-'.repeat(COLS), INK2);
    const blank = () => { y += LH*0.6; };
    const norm = t => up(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const initial = id => { const n = norm(nameOf(id)); let k = 1; while (k < n.length && state.people.some(p => p.id !== id && norm(nameOf(p.id)).slice(0, k) === n.slice(0, k))) k++; return n.slice(0, k); };
    /** @param {{ t: string, id?: string, w?: number }[]} segs */
    const flow = segs => { let col = 0, t = ''; for (const g of segs) { if (!g.t) continue; if (col > 2 && col + (g.w || g.t.length) > COLS) { line(t.trimEnd(), INK2); t = '  '; col = 2; }
      if (g.id) mark(col, g.t.length, markForte(g.id)); t += g.t; col += g.t.length; } if (t.trim()) line(t.trimEnd(), INK2); };
    const wrap = (t, col) => { const words = up(t).split(' '); let cur = ''; for (const w of words) { if (cur && (cur + ' ' + w).length > COLS - 2) { line('  ' + cur, col); cur = w; } else cur = cur ? cur + ' ' + w : w; } if (cur) line('  ' + cur, col); };
    const now = new Date(); const d2 = now.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'2-digit'}); const hm = now.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}).replace(':', ':') + 'H';

    center(`*** TÔ LISA ***`);
    center(fit(`${up(roomName)} · ${d2} ${hm}`, COLS)); blank(); dash();


    const VW = 10;
    const leader = (l, v) => { l = fit(l, COLS - VW - 2); const dots = '.'.repeat(Math.max(1, COLS - l.length - v.length - 2)); return `${l} ${dots} ${v}`; };

    // saldo: quem ainda paga quem, e depois quem já está quite
    const GREEN = '#15703a';
    blank(); center('*** FALTA PAGAR ***'); blank();
    if (!st.length) center('TUDO QUITADO');
    for (const t of st) { const a = fit(nameOf(t.from), 12), c = fit(nameOf(t.to), 12); mark(0, a.length, markForte(t.from)); mark(a.length + 6, c.length, markForte(t.to)); line(leader(`${a} PAGA ${c}`, 'R$ ' + num(t.cents))); }
    { const quites = state.people.filter(p => (b[p.id] || 0) === 0);
      if (quites.length && st.length) blank();
      for (const p of quites) { const n = fit(nameOf(p.id), COLS - 16); mark(0, n.length, markForte(p.id)); line(leader(n, 'QUITE'), GREEN); } }
    dash();

    // itens: descrição ...... valor, com quem pagou embaixo
    blank(); center('*** ITENS ***'); blank();
    if (!items.length) line('NADA ANOTADO');
    for (const e of items) { const cents = Math.round(e.amount*100);
      line(leader(e.desc, num(cents)));
      const pn = fit(nameOf(e.payer), 14); mark(2, pn.length, markForte(e.payer));
      if (e.shares) { const segs = /** @type {{ t: string, id?: string, w?: number }[]} */ ([{ t:'  ' }, { t: pn, id: e.payer }, { t: ' PAGOU · ' }]);
        e.among.forEach((id, i) => { const n = fit(nameOf(id), 14), v = ' ' + num(e.shares[id] || 0); segs.push({ t: n, id, w: n.length + v.length }, { t: v + (i < e.among.length - 1 ? ', ' : '') }); }); flow(segs); continue; }
      if (!e.among.includes(e.payer)) { const segs = /** @type {{ t: string, id?: string, w?: number }[]} */ ([{ t:'  ' }, { t: pn, id: e.payer }, { t: ' PAGOU · ' }]);
        e.among.forEach((id, i) => segs.push({ t: fit(nameOf(id), 14), id }, { t: i < e.among.length - 1 ? ', ' : '' })); segs.push({ t: ` DEVE${e.among.length === 1 ? '' : 'M'} TUDO` }); flow(segs); continue; }
      const all = state.people.every(p => e.among.includes(p.id));
      if (all) { line('  ' + fit(`${pn} pagou · ÷${e.among.length} todos`, COLS - 2), INK2); continue; }
      const head = `  ${pn} PAGOU · ÷${e.among.length} `; let col = head.length, t = head;
      for (const id of e.among) { const ini = initial(id); if (col + ini.length > COLS) break; mark(col, ini.length, markForte(id)); t += ini + ' '; col += ini.length + 1; }
      line(t.trimEnd(), INK2); }
    blank();
    line(leader('TOTAL', 'R$ ' + numBig(totalCents)), INK2);
    dash();
    blank(); center('* * *');
    { const widths = code128Widths('420420420420'); const units = [...widths].reduce((a, c) => a + +c, 0); const BW = 240, BH = 40, k = BW / units; let bx = W/2 - BW/2;
      x.fillStyle = INK; for (let i = 0; i < widths.length; i++) { const w = +widths[i] * k; if (i % 2 === 0) x.fillRect(bx, y - 8, w, BH); bx += w; } y += BH + 4; }
    x.fillStyle = INK2; x.textAlign = 'center'; x.fillText('tinyurl.com/tolisapp', W/2, y + 16); y += LH + 6;

    // papel na altura exata
    const H = y + M + 12;
    const c = document.createElement('canvas'); c.width = W*S; c.height = H*S; const g = c.getContext('2d'); g.scale(S, S);
    g.fillStyle = '#262626'; g.fillRect(0, 0, W, H);
    g.fillStyle = PAPER; g.fillRect(M, M + 12, W - 2*M, H - 2*M - 24);
    for (let i = 0; i < (W - 2*M) / 12; i++) { g.beginPath(); g.moveTo(M + i*12, M + 12); g.lineTo(M + i*12 + 6, M); g.lineTo(M + i*12 + 12, M + 12); g.fill();
      g.beginPath(); g.moveTo(M + i*12, H - M - 12); g.lineTo(M + i*12 + 6, H - M); g.lineTo(M + i*12 + 12, H - M - 12); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.03)'; for (let yy = M; yy < H - M; yy += 4) g.fillRect(M, yy, W - 2*M, 1);
    g.drawImage(cc, 0, 0, W*S, H*S, 0, 0, W, H);
    return new Promise(res => c.toBlob(res, 'image/png'));
  }
  const waText = () => window.open('https://wa.me/?text=' + encodeURIComponent(summaryText()), '_blank', 'noopener');
  $('#waBtn').onclick = async () => {
    const btn = $('#waBtn'); btn.disabled = true; toast('Gerando a imagem…');
    try {
      const blob = await renderReceipt(); const file = new File([blob], `evento-${roomName || 'grupo'}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text: summaryText() }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('Imagem baixada. Abrindo o WhatsApp com o texto…'); waText();
    } catch (e) { toast('Não consegui gerar a imagem: ' + e.message); waText(); }
    finally { btn.disabled = false; }
  };
  window.addEventListener('hashchange', () => location.reload());
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  const LAPIS_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M16.4 3.9a2 2 0 0 1 2.8 2.8L8.1 17.8l-3.6.9.9-3.6L16.4 3.9Z"/><path d="M16 18h6M19 15v6"/></svg>';
  const WA_SVG = '<svg class="wa" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
  function festa(x, y){
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confete';
    box.style.left = x + 'px'; box.style.top = y + 'px';
    for (let i = 0; i < 26; i++) { const s = document.createElement('i');
      const ang = Math.random() * Math.PI * 2, d = 50 + Math.random() * 130;
      s.style.cssText = `--dx:${(Math.cos(ang) * d).toFixed(0)}px;--dy:${(Math.sin(ang) * d - 60).toFixed(0)}px;--rot:${(Math.random() * 900 - 450).toFixed(0)}deg;--del:${(Math.random() * 90).toFixed(0)}ms;background:${PALETTE[i % PALETTE.length]}`;
      box.appendChild(s); }
    document.body.appendChild(box); setTimeout(() => box.remove(), 1400);
  }
  let rejogaDiva = () => {};   // atribuída abaixo; joga a ficha de novo
  // a diva só é jogada quando o código de barras entra na tela. O lugar sai de
  // uma lista de cantos ao redor do código, sempre acima do "sincronizado", e o
  // voo às vezes vem direto, às vezes dando cambalhota
  (function jogaDiva(){
    const el = /** @type {HTMLElement|null} */ (document.querySelector('.stain'));
    const bars = /** @type {HTMLElement|null} */ (document.querySelector('.bars'));
    if (!el || !bars) return;
    const r = (a, b) => a + Math.random() * (b - a);
    const D = 70, folga = 6;               // tamanho da figurinha
    let slot = 0;
    /** as vagas vazias do rodapé, medidas na página de agora */
    const vagas = () => { const papelOu = bars.offsetParent; if (!papelOu) return null;   // escondido (tela de código, carregando)
      const bt = bars.offsetTop, bl = bars.offsetLeft, bw = bars.offsetWidth, bh = bars.offsetHeight;
      const papel = /** @type {HTMLElement} */ (papelOu);
      const larg = papel.clientWidth, alt = papel.clientHeight;
      const st = $('#status'), sy = st ? st.offsetTop - D * 0.35 : bt + bh;
      const frase = $('#signoff'), caixa = frase && frase.parentElement;
      // teto: a linha tracejada logo acima do "* * *". Dali pra cima é conta, não é rodapé.
      const topo = caixa ? caixa.offsetTop - D * 0.4 : bt - D * 0.25;
      const base = bt + bh - D + folga;
      // a ficha cai inteira dentro do papel: a folga cobre o empurrãozinho do --dx/--dy
      const yMax = Math.max(topo, alt - D - 12);
      const dentro = p => ({ x: Math.max(12, Math.min(p.x, larg - D - 12)),
                             y: Math.min(Math.max(p.y, topo), yMax) });
      const v = [ { x: bl + bw - D * 0.9, y: base },        // ponta direita do código
                  { x: bl, y: base },                       // ponta esquerda do código
                  { x: bl + bw / 2 - D / 2, y: base },      // em cima do código, no meio
                  { x: bl + bw - D, y: bt - D * 0.25 },     // topo do código, à direita
                  { x: bl, y: bt - D * 0.25 },              // topo do código, à esquerda
                  { x: 12, y: sy },                         // ao lado do sincronizado, à esquerda
                  { x: larg - D - 12, y: sy },              // ao lado do sincronizado, à direita
                ];
      // ao lado do "valeu, meu bem!" só entra se sobrar vão dos dois lados: recado não se tapa
      if (caixa && frase) { const vao = (larg - frase.offsetWidth) / 2;
        if (vao >= D + 14) { const fy = caixa.offsetTop + caixa.offsetHeight / 2 - D / 2;
          v.push({ x: 12, y: fy }, { x: larg - D - 12, y: fy }); } }
      return v.map(dentro); };
    const vaga = i => { const v = vagas(); return v && v[i]; };
    // a página muda de altura ao longo da vida (entrar no evento, abrir itens),
    // então a vaga é recalculada, não guardada em pixels
    const posiciona = () => { const p = vaga(slot); if (!p) return;
      el.style.left = Math.round(p.x) + 'px'; el.style.top = Math.round(p.y) + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto'; };
    const sorteia = () => { const v = vagas(); slot = Math.floor(Math.random() * (v ? v.length : 5)); posiciona();
      el.style.setProperty('--dx', r(-8, 8).toFixed(1) + 'px');
      el.style.setProperty('--dy', r(-6, 6).toFixed(1) + 'px');
      el.style.setProperty('--rot', r(-28, 12).toFixed(1) + 'deg');
      // a ficha é jogada de fora do papel: entra pela esquerda, pela direita ou de baixo
      const vindo = Math.floor(Math.random() * 3);
      const vx = vindo === 0 ? -r(170, 280) : vindo === 1 ? r(170, 280) : r(-70, 70);
      const vy = vindo === 2 ? r(140, 230) : r(-30, 60);
      el.style.setProperty('--vx', vx.toFixed(0) + 'px');
      el.style.setProperty('--vy', vy.toFixed(0) + 'px');
      // quase sempre um voo só; de vez em quando cambalhota, e raramente ela teima e quica de novo
      const jeito = Math.random();
      el.classList.toggle('cambalhota', jeito < 0.4);
      el.classList.toggle('requica', jeito >= 0.4 && jeito < 0.52); };
    sorteia();
    if ('ResizeObserver' in window) new ResizeObserver(posiciona).observe($('#app'));
    window.addEventListener('resize', posiciona);
    if (!('IntersectionObserver' in window)) return el.classList.add('voou');
    // uma jogada só: depois que ela cai, rolar de novo não traz outra.
    // recomeça quando a pessoa troca de nome, aí sim vale outra ficha
    const olho = new IntersectionObserver(es => { for (const e of es) {
      if (!e.isIntersecting) continue;
      if (el.classList.contains('hidden')) continue;   // nota sem gasto: a ficha espera
      sorteia(); el.classList.add('voou'); olho.unobserve(bars);
    } }, { threshold: .55 });
    olho.observe(bars);
    rejogaDiva = () => { el.classList.remove('voou'); olho.observe(bars); };
  })();
  // uma seção só anima quando chega na tela; a fila cuida da ordem de cima pra baixo
  let olhoSec = null;
  function armaOlho(){
    if (!('IntersectionObserver' in window)) { mineNaTela = itensNaTela = settleNaTela = true; return; }
    if (olhoSec) olhoSec.disconnect();
    olhoSec = new IntersectionObserver(es => { let mudou = false;
      for (const e of es) { if (!e.isIntersecting) continue;
        if (e.target.id === 'mine' && !mineNaTela) { mineNaTela = true; mudou = true; }
        if (e.target.id === 'itemsSec' && !itensNaTela) { itensNaTela = true; mudou = true; }
        if (e.target.id === 'settle' && !settleNaTela) { settleNaTela = true; mudou = true; }
        if (olhoSec) olhoSec.unobserve(e.target); }
      if (mudou) render(); }, { threshold: .08 });
    for (const id of ['#mine', '#itemsSec', '#settle']) olhoSec.observe($(id));
  }
  /** nota nova (outro evento, outra pessoa): tudo volta pra fila e espera a tela de novo */
  function rearmaAnims(){ vistos.clear(); pixVisto.clear();
    settleT = riscoT = mineT = itensT = filaT = 0;
    mineNaTela = itensNaTela = settleNaTela = false;
    const ca = $('#itemsCaret'); ca.classList.remove('pisca'); delete ca.dataset.pisca; ca.style.animationDelay = '';
    armaOlho(); }
  armaOlho();
  let tt; function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2200); }

  // ---------- código de barras (Code 128 C) ----------
  function code128Widths(digits){
    const P = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232'.split(' ');
    const codes = [105]; for (let i = 0; i < digits.length; i += 2) codes.push(+digits.slice(i, i + 2));
    codes.push(codes.reduce((a, c, i) => a + c * (i || 1), 0) % 103);
    return codes.map(c => P[c]).join('') + '2331112';
  }
  (function barcode(){
    const widths = code128Widths('420420420420'); let x = 0, rects = '';
    for (let i = 0; i < widths.length; i++) { const w = +widths[i]; if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="40"/>`; x += w; }
    $('#bars').innerHTML = `<svg viewBox="0 0 ${x} 40" preserveAspectRatio="none" fill="#222" aria-hidden="true">${rects}</svg>`;
  })();

  // ---------- início ----------
  (async () => {
    const c = location.hash.match(/#c=([^&]+)/);
    if (c) { const code = decodeURIComponent(c[1]).trim().toLowerCase(); try { return await enterRoom(code); } catch (e) { return showGate(e.message); } }
    let saved = null; try { saved = JSON.parse(ls.get('racha:room')); } catch {}
    if (saved && /^[0-9a-f]{64}$/.test(saved.id || '') && DB && !location.hash.includes('seed=')) return openGroup(saved.code, saved.id);
    ls.del('racha:room');   // resto de versão antiga
    showGate();
  })();
})();
