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
  const PALETTE = ['#1f4e9c','#a3510a','#5b21b6','#0f6b6b','#8a1a6b','#7a2d0c','#374151','#0e7490','#9d174d','#5a4a1a']; // sem vermelho/verde, que são os tons de deve/recebe
  const colorOf = id => PALETTE[Math.max(0, state.people.findIndex(p => p.id === id)) % PALETTE.length];
  const nm = id => `<span class="nm" style="color:${colorOf(id)}">${esc(nameOf(id))}</span>`;
  const nmByName = name => { const p = state.people.find(q => q.name === name); return p ? nm(p.id) : esc(name); };
  const nmList = ids => ids.map(nm).join(', ');
  let showAll = false, itemsOpen = false; const openItems = new Set();
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
  const fmt = n => { const [i, d] = Math.abs(n).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
  const money = n => `${CURRENCY}\u00a0${fmt(n)}`;
  const nameOf = id => (state.people.find(p => p.id === id) || {name:'?'}).name;
  const listNames = ids => ids.map(nameOf).map(esc).join(', ');
  // frases de boteco: sorteadas uma vez por abertura, escolhidas pelo estado da conta
  const SIGNOFF = {
    owe: ['Paga logo, pai.', 'Fiado só amanhã.', 'Não aceitamos cheque.', 'A conta não se paga sozinha.', 'Bebeu, pagou.'],
    owed: ['Cobra sem dó.', 'Quem deve, deve.', 'Juros só na amizade.', 'Fiado é confiança.'],
    even: ['Tudo certo, volte sempre!', 'Casa limpa.', 'Valeu, pai!', 'Freguês bom é freguês quite.'],
    all: ['Casa fechada, todo mundo quite.', 'Ninguém deve nada. Milagre.', 'Zerou. Bora abrir outra?'],
    none: ['Valeu, pai!', 'Volte sempre!', 'Gorjeta não incluída.', 'Aberto até o último pagar.'],
  };
  const luck = Math.random();
  const pick = list => list[Math.floor(luck * list.length)];
  function render(){
    if (!state) return;
    $('#roomLabel').textContent = roomName || '—';
    document.title = roomName ? `${roomName} · Tô Lisa` : 'Tô Lisa · quem me deve?';
    $('#roomLabel').onclick = showEvents;
    $('#whoLine').innerHTML = me && state.people.some(p => p.id === me) ? `Sou <a class="link" id="whoBtn">${esc(nameOf(me))}</a>` : `<a class="link" id="whoBtn">Quem é você?</a>`;
    $('#whoBtn').onclick = showWho;
    const hasMe = me && state.people.some(p => p.id === me);
    { const bal = hasMe ? (balances()[me] || 0) : 0; const allEven = state.people.length > 0 && Object.values(balances()).every(v => v === 0) && state.expenses.length > 0;
      $('#tagline').textContent = !hasMe || bal > 0 ? 'quem me deve?' : bal < 0 ? 'pra quem eu devo?' : 'não devo a ninguém.';
      $('#signoff').textContent = pick(allEven ? SIGNOFF.all : !hasMe ? SIGNOFF.none : bal < 0 ? SIGNOFF.owe : bal > 0 ? SIGNOFF.owed : SIGNOFF.even); }
    if (hasMe) { const bal = balances()[me] || 0; const ln = (l, v, cls='') => `<div class="row ${cls}"><span class="l">${l}</span><span class="d"></span><span class="v">${v}</span></div>`;
      $('#mine').classList.remove('hidden');
      const stMe = settlements(balances());
      const pixB = t => !pixReady ? `<span class="spin" style="width:11px;height:11px;border:1.5px dotted var(--ink2);border-radius:50%;animation:spin 1.1s linear infinite;display:inline-block" title="carregando"></span>` : pixKeys[t.to] ? `<button class="ico" data-pix="${t.to}|${t.cents}" title="copiar pix">${PIX_SVG}${COPY_SVG}</button>` : '';
      const okB = t => `<button class="ico ok" data-settle="${t.from}|${t.to}|${t.cents}" title="quitar">✔</button>`;
      const who = bal > 0 ? stMe.filter(t => t.to === me).map(t => ln(nm(t.from), money(t.cents/100), 'sub')) : bal < 0 ? stMe.filter(t => t.from === me).map(t => ln(`<span class="n">${nm(t.to)}</span><span style="display:inline-flex;align-items:center;gap:2px;margin-left:2px">${okB(t)}${pixB(t)}</span>`, `R$&nbsp;<a class="link" style="color:inherit" title="copiar valor" data-copy-value="${fmt(t.cents/100)}">${fmt(t.cents/100)}</a>`, 'sub')) : [];
      const hdr = '';
      $('#mineRows').innerHTML = ln(bal > 0 ? 'me devem' : bal < 0 ? 'eu devo' : 'quites', money(Math.abs(bal)/100), bal > 0 ? 'pos' : bal < 0 ? 'neg' : 'ok') + hdr + who.join(''); }
    else $('#mine').classList.add('hidden');
    $('#itemsSec').classList.toggle('hidden', hasMe && (balances()[me] || 0) === 0 && state.expenses.some(e => e.kind !== 'payment'));
    const myBal = hasMe ? (balances()[me] || 0) : 0;
    const pixWant = !hasMe || myBal <= 0 || pixKeys[me] ? '' : !pixReady ? `<span class="acts"><span class="spin" title="carregando"></span></span>` : `<button class="ico amb" id="pixBtn">${PIX_SVG}${KEY_SVG} cadastrar chave pix</button>`;
    const pl = $('#pixLine');
    if (!pixWant) { if (pl.dataset.k && !pl.classList.contains('gone')) { pl.classList.add('gone'); setTimeout(() => { if (pl.classList.contains('gone')) { pl.innerHTML = ''; pl.dataset.k = ''; } }, 450); } }
    else { pl.classList.remove('gone'); if (pl.dataset.k !== pixWant) { pl.innerHTML = pixWant; pl.dataset.k = pixWant; } }
    if ($('#pixBtn')) $('#pixBtn').onclick = savePix;
      $('#peopleLine').innerHTML = state.people.map(p => nm(p.id)).join(', ') || 'ninguém';

    const payerSel = $('#payer'); const prevPayer = payerSel.value || me;
    payerSel.innerHTML = state.people.map(p => `<option value="${p.id}">${esc(p.name)} pagou</option>`).join('');
    if (state.people.some(p => p.id === prevPayer)) payerSel.value = prevPayer;

    const prev = inputs('#splitChips input');
    const known = new Set(prev.map(i => i.value)), checked = new Set(prev.filter(i => i.checked).map(i => i.value));
    $('#splitChips').innerHTML = state.people.map(p => { const on = !known.has(p.id) || checked.has(p.id);
      return `<label class="chip ${on?'on':''}"><input type="checkbox" value="${p.id}" ${on?'checked':''}>${esc(p.name)}</label>`; }).join('');
    updateHint();

    const b = balances();
    const line = (l, v, cls='', extra='') => `<div class="row ${cls}"><span class="l">${l}</span><span class="d"></span><span class="v">${v}</span>${extra}</div>`;
    const num = c => fmt(c/100);

    const s = settlements(b);
    const pays = state.expenses.filter(e => e.kind === 'payment').slice(-5).reverse();
    $('#settle').innerHTML = (s.map(t => line(`${nm(t.from)} → ${nm(t.to)}`, money(t.cents/100), t.from === me ? 'mine' : '') +
        (t.to === me ? `<div class="small acts" style="margin:4px 0 10px;justify-content:flex-start"><button class="ico" data-cobrar="${t.from}|${t.cents}" title="cobrar pelo whatsapp">👀 cobrar</button></div>` : '') +
        (t.from === me ? `<div class="small acts" style="margin:4px 0 10px;justify-content:flex-start">${!pixReady ? '<span class="spin"></span>' : ''}${pixReady ? `<button class="ico ok" data-settle="${t.from}|${t.to}|${t.cents}">✔ quitar</button>` : ''}${pixReady && pixKeys[t.to] ? `<button class="ico" data-pix="${t.to}|${t.cents}">${PIX_SVG}copiar pix</button>` : ''}</div>` : '')).join('') || '<div class="empty">tudo quitado 🎉</div>')
      + pays.map(e => line(`${lastSeen > 0 && e.at > lastSeen && (!me || e.by !== nameOf(me)) ? '<span class="tag">novo</span>' : ''}${nm(e.payer)} → ${nm(e.among[0])}`, money(e.amount), 'paid', '<span class="stamp">PAGO</span>') +
        `<div class="small">${new Date(e.at).toLocaleDateString('pt-BR')}${e.by?` · por ${esc(e.by)}`:''}</div>`).join('');

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
    $('#itemsCount').textContent = `${all.length} ${all.length === 1 ? 'item' : 'itens'}`; $('#itemsCaret').textContent = itemsOpen ? '▾' : '▸'; $('#itemsBody').classList.toggle('hidden', !itemsOpen);
    $('#total').textContent = money(items.reduce((a, e) => a + Math.round(e.amount*100), 0) / 100);
  }
  let splitMode = 'equal';
  const customShares = () => { const o = {}; for (const i of inputs('#sharesBox input')) o[i.dataset.share] = Math.round((parseFloat(i.value) || 0) * 100); return o; };
  function updateHint(){
    const among = inputs('#splitChips input:checked').map(i => i.value);
    const payer = $('#payer').value; const h = $('#splitHint'); const total = Math.round((parseFloat($('#amount').value) || 0) * 100);
    $('#modeToggle').textContent = splitMode === 'equal' ? 'dividir em partes diferentes' : 'voltar pra partes iguais';
    $('#sharesBox').classList.toggle('hidden', splitMode !== 'custom');
    if (splitMode === 'custom') {
      const prev = customShares();
      $('#sharesBox').innerHTML = among.map(id => `<div class="row"><span class="l">${nm(id)}</span><span class="d"></span><input type="number" step="0.01" min="0" inputmode="decimal" placeholder="0,00" data-share="${id}" value="${prev[id] ? (prev[id]/100).toFixed(2) : ''}"></div>`).join('');
      const sum = Object.values(customShares()).reduce((a, b) => a + b, 0);
      h.textContent = !among.length ? 'Marque quem divide esse gasto.' : `Partes somam ${money(sum/100)} de ${money(total/100)}${sum !== total ? (sum < total ? ` · faltam ${money((total-sum)/100)}` : ` · sobram ${money((sum-total)/100)}`) : ' ✔'}`;
      return;
    }
    if (!among.length) h.textContent = 'Marque quem divide esse gasto.';
    else if (!among.includes(payer)) h.textContent = `Empréstimo: ${among.map(nameOf).join(', ')} deve${among.length===1?'':'m'} o valor todo a ${nameOf(payer)}.`;
    else h.textContent = `Dividido igualmente entre ${among.length} pessoa${among.length===1?'':'s'}.`;
  }
  $('#modeToggle').onclick = () => { splitMode = splitMode === 'equal' ? 'custom' : 'equal'; updateHint(); };
  $('#amount').addEventListener('input', () => { if (splitMode === 'custom') updateHint(); });
  document.addEventListener('input', ev => { const tgt = /** @type {HTMLElement} */ (ev.target); if (tgt.matches('#sharesBox input')) { const among = inputs('#splitChips input:checked').map(i => i.value); const total = Math.round((parseFloat($('#amount').value) || 0) * 100); const sum = Object.values(customShares()).reduce((a, b) => a + b, 0);
    $('#splitHint').textContent = `Partes somam ${money(sum/100)} de ${money(total/100)}${sum !== total ? (sum < total ? ` · faltam ${money((total-sum)/100)}` : ` · sobram ${money((sum-total)/100)}`) : ' ✔'}`; } });

  // ---------- telas ----------
  let overlayCancel = null, overlaySticky = false;
  const overlay = (html, sticky = false) => { overlayCancel = null; overlaySticky = sticky; $('#overlayBox').innerHTML = html; $('#overlay').classList.remove('hidden'); };
  const closeOverlay = () => $('#overlay').classList.add('hidden');
  $('#overlay').addEventListener('click', ev => { if (ev.target.id !== 'overlay' || overlaySticky) return; const c = overlayCancel; overlayCancel = null; closeOverlay(); if (c) c(); });

  function ask(title, desc, okLabel = 'confirmar'){
    return new Promise(res => {
      overlay(`<h2 style="margin-top:0">${title}</h2>${desc ? `<p class="muted" style="margin:0 0 12px;text-align:center">${desc}</p>` : ''}<button id="okBtn" class="big">${okLabel}</button><div class="c" style="margin-top:12px"><button id="cancelBtn" class="ghost">voltar</button></div>`);
      overlayCancel = () => res(false); $('#okBtn').onclick = () => { closeOverlay(); res(true); }; $('#cancelBtn').onclick = () => { closeOverlay(); res(false); }; $('#okBtn').focus();
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
    const intro = msg ? '' : `<div class="c" style="text-transform:none;font-size:18px;line-height:1.4;margin:2px 0 6px">tipo Splitwise, só que sem app e sem cadastro.</div>
      <div style="font-size:17px;color:var(--ink2);line-height:1.5;margin:0 auto 4px;max-width:340px">
        <div>1. anote quem pagou o quê e com quem dividiu</div>
        <div>2. ela diz quem paga quem, com pix pronto</div>
        <div>3. o código do evento é a senha</div>
      </div>`;
    overlay(`<h1>Tô lisa(o)</h1><div class="c muted" style="text-transform:none">quem me deve?</div>${intro}<div class="hr"></div><h2 style="margin-top:0">Evento</h2><p class="muted" style="margin:0 0 12px;text-align:center">${msg || 'digite o código pra entrar. não existe ainda? a página cria na hora.'}</p>
      <form id="gateForm" autocomplete="off"><input id="gateCode" placeholder="código do evento" required autofocus autocapitalize="none">
      <p id="gateErr" class="status err" style="margin:0"></p><button class="big">Abrir</button></form>`, true);
    $('#gateForm').onsubmit = async ev => {
      ev.preventDefault();
      const btn = ev.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Abrindo…';
      try { await enterRoom($('#gateCode').value.trim().toLowerCase()); }
      catch (e) { $('#gateErr').textContent = e.message; btn.disabled = false; btn.textContent = 'Abrir'; }
    };
  }
  function showWho(){
    const opts = state.people.map(p => `<option value="${p.id}" ${p.id===me?'selected':''}>${esc(p.name)}</option>`).join('');
    overlay(`<h2 style="margin-top:0">Quem é você?</h2><p class="muted" style="margin:0 0 12px;text-align:center">vira o pagador padrão e assina o que você anotar</p>
      <form id="whoForm"><select id="whoSel"><option value="">— escolha seu nome —</option>${opts}<option value="__new">Outra pessoa (me adicionar)</option></select>
      <input id="whoNew" class="hidden" placeholder="seu nome" maxlength="30">
      <input id="whoPix" placeholder="chave pix (opcional)" maxlength="80" autocapitalize="none" autocomplete="off" value="${esc(me && pixKeys[me] || '')}">
      <div class="muted" style="text-transform:none;font-size:15px;margin-top:-6px">só chave aleatória ou e-mail. CPF e telefone não.</div>
      <button class="big">Continuar</button></form>
      <div class="c" style="margin-top:12px"><button id="leaveBtn" class="ghost">sair</button></div>`, !(me && state.people.some(p => p.id === me)));
    $('#leaveBtn').onclick = async () => { if (await ask('Sair do evento?', 'só neste aparelho. você volta pelo link ou pelo código.', 'sair')) leave(); };
    $('#whoSel').onchange = () => { const v = $('#whoSel').value; $('#whoNew').classList.toggle('hidden', v !== '__new'); $('#whoPix').value = pixKeys[v] || ''; };
    $('#whoForm').onsubmit = ev => { ev.preventDefault(); let v = $('#whoSel').value;
      const k = $('#whoPix').value.trim(); let key = null;
      if (k && k !== (pixKeys[v] || '')) { key = validPixKey(k); if (!key) return toast('Só chave aleatória ou e-mail'); }
      if (v === '__new') { const n = $('#whoNew').value.trim(); if (!n) return; const p = { id: uid(), name: n, at: Date.now() }; state.people.push(p); v = p.id; commit(); }
      if (!v) return; me = v; ls.set(meKey(), me); closeOverlay(); render(); $('#payer').value = me; updateHint();
      if (key) putPix(me, key); };
  }
  function showLost(){
    clearInterval(pollTimer);
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
    state = cacheLoad(); if (state) render();
    closeOverlay(); setStatus('Carregando…');
    pixKeys = {}; pixReady = false;
    try { const remote = await apiGet(groupId); state = merge(state, remote); if (!state.name && code) { state.name = code; state.updatedAt = Date.now(); apiPut(groupId, state).catch(() => {}); } cacheSave(); render(); setStatus('Sincronizado'); }
    catch (e) { if (e.notFound) return showLost(); if (!state) { state = fresh(code); render(); } setStatus('Offline · ' + e.message, true); }
    if (!me || !state.people.some(p => p.id === me)) showWho();
    startPolling(); sync(); loadPixKeys();
  }
  async function listEvents(){
    const r = await fetch(`${DB}/rooms.json?shallow=true`, { cache:'no-store' }); if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const ids = Object.keys((await r.json()) || {});
    const names = await Promise.all(ids.map(async id => { try { const rr = await fetch(`${DB}/rooms/${id}/name.json`, { cache:'no-store' }); return rr.ok ? await rr.json() : null; } catch { return null; } }));
    return ids.map((id, i) => ({ id, name: names[i] })).filter(e => typeof e.name === 'string' && e.name).sort((a, b) => a.name.localeCompare(b.name));
  }
  function showEvents(){
    overlay(`<h2 style="margin-top:0">Eventos</h2><p class="muted" style="margin:0 0 12px;text-align:center">toque num evento pra abrir</p><div id="evList" class="c" style="text-transform:none;line-height:2">carregando…</div>
      <div class="c" style="margin-top:14px"><button id="evNew" class="ghost">+ novo evento</button> · <button id="evBack" class="ghost">voltar</button></div>`);
    $('#evNew').onclick = () => showGate('Código do novo evento:'); $('#evBack').onclick = closeOverlay;
    listEvents().then(list => { $('#evList').innerHTML = list.map(e => `<div><a class="link" data-ev="${esc(e.name)}">${esc(e.name)}</a>${e.id === groupId ? ' <span class="muted">(atual)</span>' : ''}</div>`).join('') || 'nenhum evento ainda'; })
      .catch(e => { $('#evList').textContent = 'Não consegui listar: ' + e.message + '. Regras do banco atualizadas?'; });
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
    const among = inputs('#splitChips input:checked').map(i => i.value); const amount = parseFloat($('#amount').value);
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
    const evl = near('[data-ev]');
    if (evl) { const code = evl.dataset.ev; if (code === roomName) return closeOverlay(); $('#evList').textContent = 'abrindo…'; enterRoom(code).catch(e => toast(e.message)); return; }
    const px = near('[data-pix]');
    if (px) { const [to, cents] = px.dataset.pix.split('|'); const code = pixCode(pixKeys[to], nameOf(to), +cents);
      navigator.clipboard.writeText(code).then(() => toast('Pix copia e cola copiado. Cola no app do banco.'), () => showCopy('Pix copia e cola', code)); }
    const cb = near('[data-cobrar]');
    if (cb) { const [from, cents] = cb.dataset.cobrar.split('|'); const pix = me && pixKeys[me] ? `\npix: ${pixKeys[me]}` : '';
      window.open('https://wa.me/?text=' + encodeURIComponent(`👀 ${nameOf(from)}, tá faltando ${money(+cents/100)} do *${roomName}*${pix}\n${shareUrl()}`), '_blank', 'noopener'); return; }
    const st = near('[data-settle]');
    if (st) { const [from, to, cents] = st.dataset.settle.split('|'); const amount = +cents/100;
      if (!(await ask('Quitar?', `${nm(from)} pagou <b style="color:var(--green)">${money(amount)}</b> pra ${nm(to)}`, 'quitei'))) return;
      state.expenses.push({ id: uid(), kind:'payment', desc:'Pagamento', amount, payer: from, among:[to], at: Date.now(), by: me ? nameOf(me) : undefined }); commit(); toast('Quitado!');
      window.open('https://wa.me/?text=' + encodeURIComponent(`✅ ${nameOf(to)}, te paguei ${money(amount)} do *${roomName}* 👍\n${shareUrl()}`), '_blank', 'noopener'); }
    const cv = near('[data-copy-value]');
    if (cv) { const val = cv.dataset.copyValue; navigator.clipboard.writeText(val).then(() => toast('Valor copiado. Cola no app do banco.'), () => showCopy('Valor', val)); return; }
    const de = near('[data-del-expense]');
    if (de) { const id = de.dataset.delExpense; const e = state.expenses.find(x => x.id === id); if (!e) return;
      if (!(await ask('Excluir item?', `${esc(e.desc)} · ${money(e.amount)}`, 'excluir'))) return;
      state.expenses = state.expenses.filter(x => x.id !== id); state.deleted.push(id); commit(); }
  });
  const shareUrl = () => `${location.origin}${location.pathname}#c=${encodeURIComponent(roomName)}`;
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
    const pays = state.expenses.filter(e => e.kind === 'payment').slice(-5).reverse();
    const items = [...state.expenses.filter(e => e.kind !== 'payment')].reverse();
    const totalCents = items.reduce((a, e) => a + Math.round(e.amount*100), 0);
    const W = 720, M = 24, P = 36, S = 2, FS = 28, LH = 34;
    const cc = document.createElement('canvas'); cc.width = W*S; cc.height = 4000*S; const x = cc.getContext('2d'); x.scale(S, S);
    x.font = `${FS}px 'VT323'`; x.textBaseline = 'alphabetic';
    const cw = x.measureText('M').width, COLS = Math.floor((W - 2*M - 2*P) / cw);
    const INK = '#2a2a2a', INK2 = '#5a5a5a', PAPER = '#efe9d8', HL = '#f7f23a';
    const MARK = ['#a9c4f5','#f7b877','#cdb4f7','#9fdcdc','#f2a9d6','#f0b89a','#cfd3d8','#a5dbe8','#f5b3cf','#d6cdb0']; // mesma ordem de tons da PALETTE do site
    const markOf = id => MARK[Math.max(0, state.people.findIndex(p => p.id === id)) % MARK.length];
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
      if (g.id) mark(col, g.t.length, markOf(g.id)); t += g.t; col += g.t.length; } if (t.trim()) line(t.trimEnd(), INK2); };
    const wrap = (t, col) => { const words = up(t).split(' '); let cur = ''; for (const w of words) { if (cur && (cur + ' ' + w).length > COLS - 2) { line('  ' + cur, col); cur = w; } else cur = cur ? cur + ' ' + w : w; } if (cur) line('  ' + cur, col); };
    const now = new Date(); const d2 = now.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'2-digit'}); const hm = now.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}).replace(':', ':') + 'H';

    center(`*** TÔ LISA(O) ***`);
    x.fillStyle = INK2; x.textAlign = 'center'; x.fillText('tinyurl.com/tolisao', W/2, y); y += LH;
    center(fit(`${up(roomName)} · ${d2} ${hm}`, COLS)); blank(); dash(); blank();

    // legenda de cores
    center('*** MEMBROS ***'); blank();
    { const rows = [[]]; let len = 0; for (const p of state.people) { const pn = fit(nameOf(p.id), COLS);
        if (len && len + 2 + pn.length > COLS) { rows.push([]); len = 0; } rows[rows.length - 1].push({ t: pn, id: p.id }); len += (len ? 2 : 0) + pn.length; }
      for (const row of rows) { const w = row.reduce((a, g) => a + g.t.length, 0) + 2 * (row.length - 1); let col = Math.floor((COLS - w) / 2), t = ' '.repeat(col);
        for (const g of row) { mark(col, g.t.length, markOf(g.id)); t += g.t + '  '; col += g.t.length + 2; } line(t.trimEnd(), INK2); } }
    blank(); dash();

    // itens: descrição ...... valor, com quem pagou embaixo
    blank(); center('*** ITENS ***'); blank();
    const VW = 10;
    const leader = (l, v) => { l = fit(l, COLS - VW - 2); const dots = '.'.repeat(Math.max(1, COLS - l.length - v.length - 2)); return `${l} ${dots} ${v}`; };
    if (!items.length) line('NADA ANOTADO');
    for (const e of items) { const cents = Math.round(e.amount*100);
      line(leader(e.desc, num(cents)));
      const pn = fit(nameOf(e.payer), 14); mark(2, pn.length, markOf(e.payer));
      if (e.shares) { const segs = /** @type {{ t: string, id?: string, w?: number }[]} */ ([{ t:'  ' }, { t: pn, id: e.payer }, { t: ' PAGOU · ' }]);
        e.among.forEach((id, i) => { const n = fit(nameOf(id), 14), v = ' ' + num(e.shares[id] || 0); segs.push({ t: n, id, w: n.length + v.length }, { t: v + (i < e.among.length - 1 ? ', ' : '') }); }); flow(segs); continue; }
      if (!e.among.includes(e.payer)) { const segs = /** @type {{ t: string, id?: string, w?: number }[]} */ ([{ t:'  ' }, { t: pn, id: e.payer }, { t: ' PAGOU · ' }]);
        e.among.forEach((id, i) => segs.push({ t: fit(nameOf(id), 14), id }, { t: i < e.among.length - 1 ? ', ' : '' })); segs.push({ t: ` DEVE${e.among.length === 1 ? '' : 'M'} TUDO` }); flow(segs); continue; }
      const all = state.people.every(p => e.among.includes(p.id));
      if (all) { line('  ' + fit(`${pn} pagou · ÷${e.among.length} todos`, COLS - 2), INK2); continue; }
      const head = `  ${pn} PAGOU · ÷${e.among.length} `; let col = head.length, t = head;
      for (const id of e.among) { const ini = initial(id); if (col + ini.length > COLS) break; mark(col, ini.length, markOf(id)); t += ini + ' '; col += ini.length + 1; }
      line(t.trimEnd(), INK2); }
    blank();
    line(leader('TOTAL', 'R$ ' + numBig(totalCents)), INK2);
    dash();

    // saldo por pessoa
    const GREEN = '#15703a', RED = '#9b1c1c';
    const ppl = state.people.map(p => ({ id: p.id, v: b[p.id] || 0 })).sort((p, q) => q.v - p.v);
    const signed = v => (v > 0 ? '+' : '-') + 'R$ ' + num(Math.abs(v));
    blank(); center('*** SALDO ***'); blank();
    for (const p of ppl) { const n = fit(nameOf(p.id), COLS - 16); mark(0, n.length, markOf(p.id));
      line(leader(n, p.v === 0 ? 'QUITE' : signed(p.v)), p.v === 0 ? GREEN : p.v > 0 ? INK : RED); }
    if (st.length) { blank(); line('QUEM PAGA QUEM', INK2);
      for (const t of st) { const a = fit(nameOf(t.from), 12), c = fit(nameOf(t.to), 12); mark(2, a.length, markOf(t.from)); mark(2 + a.length + 6, c.length, markOf(t.to)); line(leader(`  ${a} PAGA ${c}`, 'R$ ' + num(t.cents))); } }
    dash();
    blank(); center('* * *');
    { const widths = code128Widths('420420420420'); const units = [...widths].reduce((a, c) => a + +c, 0); const BW = 240, BH = 40, k = BW / units; let bx = W/2 - BW/2;
      x.fillStyle = INK; for (let i = 0; i < widths.length; i++) { const w = +widths[i] * k; if (i % 2 === 0) x.fillRect(bx, y - 8, w, BH); bx += w; } y += BH + 4; }
    y += 10;

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
