// contraste: abre cada tema e cada janela e lista, elemento por elemento, o contraste do texto e da borda contra o fundo
// (#299). Ferramenta, não teste: não roda no CI. Marca o que fica abaixo de 4,5:1 (texto) e 3:1 (borda, ícone).
// Mede também o :hover e o :active dos botões (forçados pelo DevTools, sem clicar).
//   npm run contraste                  todos os temas, todas as telas, só o que falha
//   npm run contraste -- --tema=neon   um tema (papel, natal, neon, grafite)
//   npm run contraste -- --tela=quitar uma tela (as chaves de TELAS)
//   npm run contraste -- --tudo        lista também o que passa
// O fundo é a soma das cores de fundo dos pais (com transparência); fundo de imagem/gradiente entra pela cor de baixo
// e sai marcado com "~". Sombra e brilho (text-shadow) não contam. Elemento que flutua sobre outro sem ser filho dele
// (o ✎, o compartilhar) tem o texto e o ícone medidos contra o próprio fundo, e a borda fica de fora (o de trás muda
// com a rolagem).
const { chromium } = require('./_pw.cjs');
const servir = require('./_serve.cjs');
const { DADOS, poeTema, esquema } = require('./preview.cjs');

const TEXTO = 4.5, BORDA = 3;

/** escolhe quem eu sou, do jeito que a página oferecer (o cabeçalho ou o cartão) */
async function souLia(p) {
  await p.waitForSelector('#whoBtn, #chegada [data-chegou]');
  if (await p.locator('#whoBtn').count()) await p.click('#whoBtn');
  await p.locator('#chegada [data-chegou], #overlayBox [data-sou]', { hasText: /^Lia$/ }).first().click();
  await p.waitForTimeout(600);
}
const abreEvento = async (p, porta) => { await p.goto(`http://localhost:${porta}/?evento=${DADOS.name}`); };
const cartao = p => p.waitForSelector('#overlay:not(.hidden) #overlayBox h2');

// cada tela: como chegar nela e o que medir (a página inteira ou só o cartão por cima)
const TELAS = {
  pagina: { nome: 'a página do evento', vai: async (p, porta) => { await abreEvento(p, porta); await souLia(p); }, raiz: 'body' },
  chegada: { nome: 'chegou pelo link, ainda sem nome', vai: async (p, porta) => {
    await abreEvento(p, porta); await p.waitForSelector('#whoBtn, #chegada [data-chegou]'); await p.waitForTimeout(600);
    if (await p.locator('#whoBtn').count()) { await p.click('#whoBtn'); await cartao(p); } }, raiz: 'body' },
  anotar: { nome: 'o anotar', vai: async (p, porta) => {
    await abreEvento(p, porta); await souLia(p); await p.click('#fab'); await p.waitForTimeout(500); }, raiz: '#sheet' },
  quem: { nome: 'Quem é você?', vai: async (p, porta) => {
    await abreEvento(p, porta); await souLia(p); await p.evaluate(() => document.querySelector('#whoBtn')?.click());
    await cartao(p); }, raiz: '#overlay' },
  quemvai: { nome: 'Quem vai?', vai: async (p, porta) => {
    await abreEvento(p, porta); await souLia(p); await p.evaluate(() => document.querySelector('#whoBtn')?.click());
    await cartao(p); await p.selectOption('#whoSel', '__new'); await p.waitForSelector('#overlayBox .pergunta'); }, raiz: '#overlay' },
  quitar: { nome: 'confirmar que quitou', vai: async (p, porta) => {
    await abreEvento(p, porta); await souLia(p); await p.locator('[data-settle]').first().click(); await cartao(p); },
    raiz: '#overlay' },
  quitado: { nome: 'Quitado!', vai: async (p, porta) => {
    await abreEvento(p, porta); await souLia(p); await p.locator('[data-settle]').first().click(); await cartao(p);
    await p.click('#okBtn'); await p.waitForSelector('#quitOk'); await p.waitForTimeout(400); }, raiz: '#overlay' },
  eventos: { nome: 'Meus eventos', vai: async (p, porta) => {
    await abreEvento(p, porta); await souLia(p); await p.click('#roomLabel'); await cartao(p); }, raiz: '#overlay' },
  inicio: { nome: 'a estreia (aparelho limpo)', vai: async (p, porta) => {
    await p.goto(`http://localhost:${porta}/`); await p.waitForSelector('#gateCode'); await p.waitForTimeout(600); },
    raiz: '#overlay' },
};

// roda na página: acha os elementos visíveis com texto, borda ou ícone e devolve as cores já resolvidas
function mede({ raiz, so }) {
  // o fundo que vem de um ::before do pai e não dá pra achar pela árvore: { pai: 'quem fica por cima dele' }
  // (o igual/partes diferentes: a pílula que desliza é o .seg:before, atrás do botão ligado)
  const PSEUDO = { '.seg': 'button.on' };
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d', { willReadFrequently: true }));
  // qualquer formato de cor (rgb, color(srgb), color-mix já resolvido…) vira [r, g, b, a] pelo canvas
  const rgba = s => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const sobre = (c, f) => [0, 1, 2].map(i => c[i] * c[3] + f[i] * (1 - c[3])).concat(1);
  /** o fundo que fica atrás de el: dos pais pra baixo, cada um por cima do anterior */
  const fundo = el => {
    const pilha = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) pilha.unshift(e);
    let f = [255, 255, 255, 1], aprox = false;
    for (const e of pilha) {
      const s = getComputedStyle(e), c = rgba(s.backgroundColor);
      // "~" só quando a imagem é de quem dá o fundo de verdade: uma cor opaca por cima apaga a dúvida
      if (c[3] >= 1) aprox = false;
      if (s.backgroundImage !== 'none') aprox = true;
      if (c[3] > 0) f = sobre([c[0], c[1], c[2], c[3] * +s.opacity], f);
      const ps = Object.entries(PSEUDO).find(([q]) => e.matches(q));
      if (ps && el !== e && el.closest(ps[1])) { const cp = rgba(getComputedStyle(e, '::before').backgroundColor); f = sobre(cp, f); }
    }
    return { f, aprox };
  };
  const opac = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
  const visivel = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility === 'visible' && s.display !== 'none' && opac(el) > 0.05; };
  const nome = el => {
    const id = el.id ? '#' + el.id : '', cls = [...el.classList].slice(0, 2).map(c => '.' + c).join('');
    const dado = [...el.attributes].find(a => a.name.startsWith('data-') && a.name !== 'data-ct');
    return el.tagName.toLowerCase() + id + cls + (dado ? `[${dado.name}]` : '');
  };
  const texto = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
  const r = document.querySelector(raiz); if (!r) return [];
  const els = so ? [...new Set([...r.querySelectorAll('[data-ct]')].flatMap(e => [e, ...e.querySelectorAll('*')]))]
    : [r, ...r.querySelectorAll('*')];
  const out = [];
  for (const el of els) {
    if (!visivel(el) || el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    const s = getComputedStyle(el), o = opac(el), { f, aprox } = fundo(el);
    const t = texto(el) || (el.matches('textarea,input:not([type=checkbox],[type=radio],[type=hidden])') ? el.value || el.placeholder : '');
    const tag = el.tagName.toLowerCase(), desligado = el.matches(':disabled');
    const base = { el: nome(el), txt: t.slice(0, 30), aprox, desligado, fundo: f };
    if (t && tag !== 'svg') { const c = rgba(s.color); out.push({ ...base, tipo: 'texto', cor: sobre([c[0], c[1], c[2], c[3] * o], f) }); }
    // a borda conta contra o fundo de fora (o do pai), e só a de quem se toca ou se preenche: risco e pontilhado são enfeite
    const controle = el.matches('button,a,[role=button],input,select,textarea');
    const lados = ['Top', 'Right', 'Bottom', 'Left'].filter(l => parseFloat(s[`border${l}Width`]) >= 1 && s[`border${l}Style`] !== 'none');
    if (controle && lados.length && el.parentElement && s.position !== 'fixed') {
      const c = rgba(s[`border${lados[0]}Color`]), fora = fundo(el.parentElement);
      if (c[3] > 0) out.push({ ...base, tipo: 'borda', aprox: fora.aprox, fundo: fora.f, cor: sobre([c[0], c[1], c[2], c[3] * o], fora.f) });
    }
    // ícone: o svg de traço (stroke) ou preenchido, contra o fundo do botão
    if (tag === 'svg') {
      // a tinta mora no desenho de dentro (o pix pinta o path, o resto traça o svg inteiro)
      const forma = el.querySelector('path,circle,rect,line,polyline,polygon,ellipse'), sf = forma ? getComputedStyle(forma) : s;
      const t1 = sf.stroke !== 'none' ? sf.stroke : sf.fill, tinta = /currentcolor/i.test(t1) ? sf.color : t1;
      if (tinta && tinta !== 'none' && !tinta.startsWith('url')) {
        const c = rgba(tinta), dono = el.closest('button,a,[role=button]');
        out.push({ ...base, el: (dono ? nome(dono) + ' ' : '') + 'svg', tipo: 'ícone', cor: sobre([c[0], c[1], c[2], c[3] * o], f) });
      }
    }
  }
  if (!so) [...r.querySelectorAll('button,a,[role=button],input,select,textarea')].filter(visivel)
    .forEach((el, i) => el.setAttribute('data-ct', String(i)));
  return out;
}

const lum = ([r, g, b]) => { const c = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b); };
const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

async function contraste({ temas = ['papel', 'natal', 'neon', 'grafite'], telas = Object.keys(TELAS), tudo = false } = {}) {
  const { srv, porta } = await servir();
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  const achados = [];
  try {
    for (const tema of temas) for (const tela of telas) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce', colorScheme: esquema(tema) });
      await ctx.route(/fake-db/, r => {
        const u = r.request().url();
        if (u.includes('/pix/')) return r.fulfill({ json: u.includes('/fernando/') ? 'fernando@exemplo.com' : null });
        if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
        r.fulfill({ json: DADOS });
      });
      const p = await ctx.newPage();
      await poeTema(p, tema);
      const linhas = [];
      try {
        await TELAS[tela].vai(p, porta);
        const raiz = TELAS[tela].raiz;
        for (const m of await p.evaluate(mede, { raiz, so: false })) linhas.push({ ...m, estado: '' });
        // :hover e :active de cada botão, forçados pelo DevTools
        const cdp = await ctx.newCDPSession(p);
        await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
        const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
        const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-ct]' });
        for (const estado of ['hover', 'active']) {
          for (const nodeId of nodeIds) await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [estado] });
          await p.waitForTimeout(250);
          for (const m of await p.evaluate(mede, { raiz, so: true })) linhas.push({ ...m, estado: ':' + estado });
          for (const nodeId of nodeIds) await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
        }
      } catch (e) { console.error(`${tema} · ${tela}: não consegui abrir (${e.message.split('\n')[0]})`); }
      await ctx.close();
      const vistos = new Set();
      for (const l of linhas) {
        const r = razao(l.cor, l.fundo), min = l.tipo === 'texto' ? TEXTO : BORDA, falha = r < min && !l.desligado;
        const chave = [l.el, l.txt, l.tipo, hex(l.cor), hex(l.fundo)].join('|');
        // o hover que não muda nada repete a linha de repouso: fica só a primeira
        if (vistos.has(chave)) continue; vistos.add(chave);
        if (falha || tudo) achados.push({ tema, tela, ...l, razao: r, min, falha });
      }
    }
  } finally { await b.close(); srv.close(); }
  return achados;
}

module.exports = { contraste, TELAS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const op = a => (args.find(x => x.startsWith('--' + a + '=')) || '').split('=')[1];
  const tema = op('tema'), tela = op('tela');
  if (tela && !TELAS[tela]) { console.error(`tela desconhecida: ${tela} (tem ${Object.keys(TELAS).join(', ')})`); process.exit(1); }
  contraste({ temas: tema ? [tema] : undefined, telas: tela ? [tela] : undefined, tudo: args.includes('--tudo') }).then(achados => {
    let grupo = '';
    for (const a of achados) {
      const g = `${a.tema} · ${TELAS[a.tela].nome}`;
      if (g !== grupo) { console.log(`\n${g}`); grupo = g; }
      console.log(`  ${a.falha ? '✗' : '✓'} ${a.razao.toFixed(2).padStart(5)}:1${a.aprox ? '~' : ' '} ${a.tipo.padEnd(5)} ${(a.estado || '').padEnd(7)} ${a.el}${a.txt ? ` "${a.txt}"` : ''}  ${hex(a.cor)} sobre ${hex(a.fundo)}${a.desligado ? ' (desligado)' : ''}`);
    }
    const n = achados.filter(a => a.falha).length;
    console.log(`\n${n ? `${n} abaixo do mínimo (texto ${TEXTO}:1, borda e ícone ${BORDA}:1)` : 'tudo acima do mínimo'}`);
  }).catch(e => { console.error(e); process.exit(1); });
}
