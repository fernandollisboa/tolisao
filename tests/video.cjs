const { chromium } = require('./_pw.cjs');
const path = require('path'), fs = require('fs'), os = require('os');
const servir = require('./_serve.cjs');
const ficha = require('./_ficha.cjs');
const { DADOS } = require('./preview.cjs');
const { createHash } = require('crypto');
const sha256 = t => createHash('sha256').update(t).digest('hex');

const H = Date.now();
const TRES = { name: 'bailedamada', people: DADOS.people,
  expenses: [
    { id: 'i1', desc: 'Airbnb', amount: 300, payer: 'fernando', among: ['fernando','lia'], at: H - 3*86400000 },
    { id: 'i2', desc: 'Gasolina', amount: 120, payer: 'julia', among: ['julia','lia'], at: H - 2*86400000 },
    { id: 'i3', desc: 'Janta', amount: 80, payer: 'mengla', among: ['mengla','lia'], at: H - 86400000 },
  ] };

const FILA = { name: 'bailedamada', people: DADOS.people,
  expenses: [...TRES.expenses,
    { id: 'pg1', kind: 'payment', desc: 'Pagamento', amount: 40, payer: 'lia', among: ['fernando'], at: H - 3600000 }] };

const DOIS = { name: 'bailedamada', people: DADOS.people,
  expenses: [
    { id: 'i1', desc: 'Airbnb', amount: 300, payer: 'fernando', among: ['fernando','lia','klinsmann'], at: H - 3*86400000 },
    { id: 'i2', desc: 'Gasolina', amount: 120, payer: 'julia', among: ['julia','lia','klinsmann'], at: H - 2*86400000 },
  ] };

const CENAS = {
  pix: { nome: 'copiar pix brotando do ✔ e a piscada verde', quem: 'Lia', atrasoPix: 2000,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForSelector('#mineRows [data-pix]', { timeout: 8000 }); await p.waitForTimeout(4500); } },
  cascata: { nome: 'a nota se preenchendo de cima pra baixo', quem: 'Lia', atrasoPix: 1200, dados: FILA,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1200);
      await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await p.waitForTimeout(5500);
      await p.evaluate(() => document.querySelector('#settle').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await p.waitForTimeout(6000); } },
  piscas: { nome: 'três ✔ piscando um atrás do outro', quem: 'Lia', atrasoPix: 2000, dados: TRES,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForSelector('#mineRows [data-pix]', { timeout: 8000 }); await p.waitForTimeout(6000); } },
  troca: { nome: 'trocar de pessoa refaz a nota inteira', quem: 'Klinsmann', atrasoPix: 800, dados: DOIS,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(4500);
      await p.click('#whoBtn'); await p.waitForSelector('#whoSel');
      await p.selectOption('#whoSel', { label: 'Lia' });
      await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(5000); } },
  chave: { nome: 'o cadastrar chave pix descendo do título', quem: 'Júlia', atrasoPix: 2500,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForSelector('#pixBtn', { timeout: 9000 }); await p.waitForTimeout(4000); } },
  ficha: { nome: 'a ficha caindo quando a página acaba', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
      await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
      await p.waitForTimeout(5000); } },
  pega: { nome: 'dois toques a ficha treme, no terceiro ela descola, boia e é jogada fora', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await ficha.desce(p);
      await p.evaluate(() => { const d = document.createElement('div');
        d.style.cssText = 'position:fixed;z-index:99;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid rgba(0,0,0,.5);pointer-events:none;left:-50px;top:-50px;transition:transform .1s';
        document.body.appendChild(d);
        addEventListener('pointermove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
        addEventListener('pointerdown', () => d.style.transform = 'scale(.7)', true);
        addEventListener('pointerup', () => d.style.transform = '', true); });
      await ficha.pousa(p); await ficha.cutuca(p, 2); await ficha.agarra(p); await ficha.arrasta(p, 120, 260);
      await ficha.solta(p); await ficha.rolaPraCima(p); await ficha.joga(p); } },
  chato: { nome: 'segura, toca, segura na ficha: a diva desliga; o mesmo no rodapé liga de novo', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await ficha.desce(p); await ficha.pousa(p);
      await ficha.senha(p, '.stain'); await p.waitForTimeout(2000); await ficha.senha(p, '#signoff'); await p.waitForTimeout(400);
      await ficha.desce(p, true); await ficha.pousa(p, 8000); } },
  toque: { nome: 'o toque preenchendo o ✔ e o copiar pix, que no celular não têm hover', quem: 'Lia', atrasoPix: 900, dados: TRES,
    acao: async p => {
      await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} } }));
      await p.evaluate(() => { const d = document.createElement('div');
        d.style.cssText = 'position:fixed;z-index:99;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid rgba(0,0,0,.5);pointer-events:none;left:-50px;top:-50px;transition:transform .12s';
        document.body.appendChild(d);
        const põe = e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; };
        addEventListener('pointerdown', e => { põe(e); d.style.transform = 'scale(.7)'; }, true);
        addEventListener('pointerup', e => { põe(e); d.style.transform = ''; }, true); });
      await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForSelector('#mineRows [data-pix]', { timeout: 9000 });
      await p.waitForTimeout(3000);
      const meio = async sel => { const b = await p.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
      let o = await meio('#mineRows [data-pix]');
      await p.touchscreen.tap(o.x, o.y); await p.waitForTimeout(2200);
      o = await meio('#mineRows [data-settle]');
      await p.touchscreen.tap(o.x, o.y); await p.waitForTimeout(2200);
      await p.click('#overlay', { position: { x: 5, y: 5 } }); await p.waitForTimeout(1500); } },
  itens: { nome: 'o toquinho na linha dos itens quando ela chega na tela', quem: 'Lia', atrasoPix: 600,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(800);
      await p.evaluate(() => document.querySelector('#itemsSec').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await p.waitForTimeout(5000); } },
  risco: { nome: 'o risco correndo nas linhas pagas', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await p.evaluate(() => document.querySelector('#settle').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(3500); } },
};

async function video(opts = {}) {
  const { cena = 'pix', vel = 0.8, largura = 390, altura = 844 } = opts;
  const c = CENAS[cena]; if (!c) throw new Error(`cena desconhecida: ${cena} (tem ${Object.keys(CENAS).join(', ')})`);
  const dados = opts.dados || c.dados || DADOS;
  const saida = opts.saida || path.join(os.tmpdir(), `video-${cena}.webm`);
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'tolisa-vid-'));
  const { srv, porta } = await servir();
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  try {
    const ctx = await b.newContext({ viewport: { width: largura, height: altura }, hasTouch: true,
      recordVideo: { dir: pasta, size: { width: largura, height: altura } } });
    await ctx.route(/fake-db/, async r => {
      const u = r.request().url();
      if (u.includes('/pix/')) { if (c.atrasoPix) await new Promise(ok => setTimeout(ok, c.atrasoPix));
        return r.fulfill({ json: u.includes('/fernando/') ? 'fernando@exemplo.com' : null }); }
      if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
      r.fulfill({ json: dados });
    });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    const sala = await sha256(dados.name);
    await p.addInitScript(([sala, code, quem, gente]) => {
      try { localStorage.setItem('tolisa', JSON.stringify({ lastRoom: { code, id: sala } }));
        const eu = gente.find(x => x.name === quem);
        if (eu) localStorage.setItem(`tolisa:${sala}`, JSON.stringify({ me: eu.id })); } catch {}
    }, [sala, dados.name, c.quem, dados.people]);
    if (opts.js) await p.addInitScript(opts.js);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: vel });
    await p.goto(`http://localhost:${porta}/?senha=${dados.name}`);
    if (opts.css) await p.addStyleTag({ content: opts.css });
    await p.waitForSelector('#mine:not(.hidden)', { timeout: 8000 });
    await c.acao(p);
    if (erros.length) console.error('ERROS NA PÁGINA:', erros);
    const v = p.video(); await ctx.close();
    if (v) await v.saveAs(saida);
    return saida;
  } finally { await b.close(); srv.close(); fs.rmSync(pasta, { recursive: true, force: true }); }
}

module.exports = { video, CENAS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const cena = args.find(a => !a.startsWith('--')) || 'pix';
  const op = a => { const v = args.find(x => x.startsWith('--' + a + '=')); return v && v.split('=')[1]; };
  const arqCss = op('css'), arqJs = op('js');
  video({ cena, saida: op('saida'), vel: op('vel') ? Number(op('vel')) : undefined,
          css: arqCss ? fs.readFileSync(arqCss, 'utf8') : undefined,
          js: arqJs ? fs.readFileSync(arqJs, 'utf8') : undefined,
          largura: op('largura') ? Number(op('largura')) : undefined })
    .then(f => console.log(f)).catch(e => { console.error('FAIL', e); process.exit(1); });
}
