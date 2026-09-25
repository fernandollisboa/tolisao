// Grava um .webm do app fazendo alguma coisa. Preview parado não mostra animação:
//   node tests/video.cjs pix                       -> o copiar pix saindo de trás do ✔
//   node tests/video.cjs ficha --saida=/tmp/f.webm -> a ficha sendo jogada no rodapé
//   node tests/video.cjs risco --vel=0.35          -> o risco correndo nas linhas pagas
// --css=arq.css redefine keyframes; --js=arq.js roda antes do app (ouvir classes, copiar atrasos).
// --vel é a velocidade das animações (0.35 = bem devagar, 1 = normal).
const { chromium } = require('./_pw.cjs');
const path = require('path'), fs = require('fs'), os = require('os');
const servir = require('./_serve.cjs');
const { DADOS } = require('./preview.cjs');
const { createHash } = require('crypto');
const sha256 = t => createHash('sha256').update(t).digest('hex');

const H = Date.now();
/** três dívidas pro ✔ piscar linha a linha; só o Fernando tem chave de pix */
const TRES = { name: 'bailedamada', people: DADOS.people,
  expenses: [
    { id: 'i1', desc: 'Airbnb', amount: 300, payer: 'fernando', among: ['fernando','lia'], at: H - 3*86400000 },
    { id: 'i2', desc: 'Gasolina', amount: 120, payer: 'julia', among: ['julia','lia'], at: H - 2*86400000 },
    { id: 'i3', desc: 'Janta', amount: 80, payer: 'mengla', among: ['mengla','lia'], at: H - 86400000 },
  ] };

/** três dívidas e um pagamento já feito: a nota inteira, pra ver a ordem de cima pra baixo */
const FILA = { name: 'bailedamada', people: DADOS.people,
  expenses: [...TRES.expenses,
    { id: 'pg1', kind: 'payment', desc: 'Pagamento', amount: 40, payer: 'lia', among: ['fernando'], at: H - 3600000 }] };

/** dois devedores: o Klinsmann com duas linhas, a Lia com uma. Pra ver a troca de pessoa */
const DOIS = { name: 'bailedamada', people: DADOS.people,
  expenses: [
    { id: 'i1', desc: 'Airbnb', amount: 300, payer: 'fernando', among: ['fernando','lia','klinsmann'], at: H - 3*86400000 },
    { id: 'i2', desc: 'Gasolina', amount: 120, payer: 'julia', among: ['julia','lia','klinsmann'], at: H - 2*86400000 },
  ] };

/** cada cena diz quem você é, quanto o pix demora e o que a câmera faz */
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
    acao: async p => { await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      // um dedo de mentira, pra quem assiste ver onde a pessoa toca
      await p.evaluate(() => { const d = document.createElement('div');
        d.style.cssText = 'position:fixed;z-index:99;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid rgba(0,0,0,.5);pointer-events:none;left:-50px;top:-50px;transition:transform .1s';
        document.body.appendChild(d);
        addEventListener('pointermove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
        addEventListener('pointerdown', () => d.style.transform = 'scale(.7)', true);
        addEventListener('pointerup', () => d.style.transform = '', true); });
      await p.waitForSelector('.stain.pousou', { timeout: 12000 }); await p.waitForTimeout(500);
      const c = async () => { const b = await p.locator('.stain').boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
      let o = await c(); await p.mouse.move(o.x, o.y, { steps: 8 }); await p.waitForTimeout(300);
      const tem = cl => p.evaluate(cl => document.querySelector('.stain').classList.contains(cl), cl);
      const exige = (ok, msg) => { if (!ok) throw new Error('pega: ' + msg); };
      for (let i = 0; i < 2; i++) { await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(550); }
      exige(!(await tem('solta')), 'descolou antes do terceiro toque');
      await p.mouse.down(); await p.waitForTimeout(250);
      exige(await tem('solta'), 'o terceiro toque não agarrou');
      await p.mouse.move(200, 380, { steps: 40 }); await p.mouse.move(120, 260, { steps: 30 }); await p.waitForTimeout(250);
      o = await c(); exige(Math.hypot(o.x - 120, o.y - 260) < 12, `não seguiu o dedo (${o.x},${o.y})`);
      await p.mouse.up(); await p.waitForTimeout(500);
      exige(!(await tem('fora')), 'soltou devagar e ela sumiu');
      exige(await tem('largada'), 'soltou devagar e ela não voltou pro papel');
      const antes = await p.evaluate(() => window.scrollY);
      await p.mouse.wheel(0, -500); await p.waitForTimeout(900);            // assentada no papel, rola junto
      const rolou = antes - (await p.evaluate(() => window.scrollY));
      const o2 = await c(); exige(Math.abs((o2.y - o.y) - rolou) < 4, `ficou presa na tela (${o.y} -> ${o2.y}, rolagem ${rolou})`);
      o = o2; await p.mouse.move(o.x, o.y, { steps: 8 }); await p.mouse.down(); await p.waitForTimeout(250);
      await p.mouse.move(o.x + 40, o.y + 10, { steps: 6 }); await p.mouse.move(o.x + 220, o.y - 120, { steps: 3 }); await p.mouse.up();
      await p.waitForTimeout(1800); exige(await tem('fora'), 'o arremesso não jogou fora');
      console.log('pega: treme, agarra no terceiro, assenta no papel e voa no arremesso'); } },
  chato: { nome: 'segura, toca, segura na ficha: a diva desliga; o mesmo no rodapé liga de novo', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await p.waitForSelector('.stain.pousou', { timeout: 12000 }); await p.waitForTimeout(400);
      const exige = (ok, msg) => { if (!ok) throw new Error('chato: ' + msg); };
      const senha = async sel => { const b = await p.locator(sel).boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
        await p.mouse.move(x, y, { steps: 6 });
        for (const ms of [650, 90, 650]) { await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); await p.waitForTimeout(250); } };
      const estado = () => p.evaluate(() => ({ chato: document.body.classList.contains('chato'), frase: document.querySelector('#signoff').textContent,
        sub: getComputedStyle(document.querySelector('#tagline')).display, ficha: getComputedStyle(document.querySelector('.stain')).display }));
      await senha('.stain'); await p.waitForTimeout(1200);
      let e = await estado(); exige(e.chato && e.frase === 'Deus é fiel.' && e.sub === 'none' && e.ficha === 'none', 'não desligou ' + JSON.stringify(e));
      exige(await p.evaluate(() => localStorage.getItem('racha:chato') === '1'), 'não guardou no aparelho');
      await p.waitForTimeout(800); await senha('#signoff'); await p.waitForTimeout(400);
      e = await estado(); exige(!e.chato && e.frase !== 'Deus é fiel.' && e.sub !== 'none', 'não ligou de volta ' + JSON.stringify(e));
      // o subtítulo volta e empurra a página: a ficha espera o fim de novo, como sempre
      await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
      await p.waitForSelector('.stain.pousou', { timeout: 8000 }); await p.waitForTimeout(600);
      console.log('chato: a senha desliga a diva, o rodapé liga de volta e a ficha é jogada de novo'); } },
  dica: { nome: 'o balão contando o que o ✔ e o copiar pix fazem, na primeira vez', quem: 'Lia', atrasoPix: 900, dados: TRES,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(700);
      await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      // as piscadas pedem "me pague"; o balão vem atrás explicando os dois botões
      await p.waitForSelector('.dicaok', { timeout: 9000 });
      await p.waitForFunction(() => !document.querySelector('.dicaok'), null, { timeout: 20000 });
      await p.waitForTimeout(900); } },
  toque: { nome: 'o toque preenchendo o ✔ e o copiar pix, que no celular não têm hover', quem: 'Lia', atrasoPix: 900, dados: TRES,
    acao: async p => {
      await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} } }));
      // um dedo de mentira, pra quem assiste ver onde a pessoa toca
      await p.evaluate(() => { const d = document.createElement('div');
        d.style.cssText = 'position:fixed;z-index:99;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid rgba(0,0,0,.5);pointer-events:none;left:-50px;top:-50px;transition:transform .12s';
        document.body.appendChild(d);
        const põe = e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; };
        addEventListener('pointerdown', e => { põe(e); d.style.transform = 'scale(.7)'; }, true);
        addEventListener('pointerup', e => { põe(e); d.style.transform = ''; }, true); });
      await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForSelector('#mineRows [data-pix]', { timeout: 9000 });
      await p.waitForTimeout(3000);   // deixa a piscada acabar: o toque é outra conversa
      const meio = async sel => { const b = await p.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
      let o = await meio('#mineRows [data-pix]');
      await p.touchscreen.tap(o.x, o.y); await p.waitForTimeout(2200);
      o = await meio('#mineRows [data-settle]');
      await p.touchscreen.tap(o.x, o.y); await p.waitForTimeout(2200);
      // fecha o cartão de quitar: o vídeo acaba na nota, com o ✔ já de volta ao normal
      await p.click('#overlay', { position: { x: 5, y: 5 } }); await p.waitForTimeout(1500); } },
  itens: { nome: 'o toquinho na linha dos itens quando ela chega na tela', quem: 'Lia', atrasoPix: 600,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(800);
      await p.evaluate(() => document.querySelector('#itemsSec').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await p.waitForTimeout(5000); } },
  risco: { nome: 'o risco correndo nas linhas pagas', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await p.evaluate(() => document.querySelector('#settle').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(3500); } },
  datilo: { nome: '"tô lisa" se digitando sozinho, com a hesitação da pontuação no fim', quem: 'Lia', atrasoPix: 0,
    // é troca de textContent por setTimeout, não CSS: o --vel do CDP não afeta o
    // tempo real dela. ~7.5s de sequência + folga pro document.fonts.ready.
    acao: async p => { await p.waitForTimeout(8600); } },
};

/**
 * @param {{cena?:string, vel?:number, largura?:number, altura?:number, dados?:any, css?:string, js?:string, saida?:string, porta?:number}} opts
 * @returns {Promise<string>} caminho do vídeo
 */
async function video(opts = {}) {
  const { cena = 'pix', vel = 0.8, largura = 390, altura = 844,
          porta = 4500 + Math.floor(Math.random()*200) } = opts;
  const c = CENAS[cena]; if (!c) throw new Error(`cena desconhecida: ${cena} (tem ${Object.keys(CENAS).join(', ')})`);
  const dados = opts.dados || c.dados || DADOS;
  const saida = opts.saida || path.join(os.tmpdir(), `video-${cena}.webm`);
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'tolisa-vid-'));
  const srv = servir(porta);
  const b = await chromium.launch();
  try {
    // hasTouch: a ficha só é pegável em aparelho de toque (navigator.maxTouchPoints)
    const ctx = await b.newContext({ viewport: { width: largura, height: altura }, hasTouch: true,
      recordVideo: { dir: pasta, size: { width: largura, height: altura } } });
    await ctx.route(/fake-db/, async r => {
      const u = r.request().url();
      // o pix chega depois do resto, como no mundo real: é isso que a animação conta
      if (u.includes('/pix/')) { if (c.atrasoPix) await new Promise(ok => setTimeout(ok, c.atrasoPix));
        return r.fulfill({ json: u.includes('/fernando/') ? 'fernando@exemplo.com' : null }); }
      if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
      r.fulfill({ json: dados });
    });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    // entra já identificado: senão o vídeo começa com a tela de código e o cartão de
    // "quem é você?" piscando, e o que interessa fica no fim
    const sala = await sha256(dados.name);
    await p.addInitScript(([sala, code, quem, gente]) => {
      try { localStorage.setItem('racha:room', JSON.stringify({ code, id: sala }));
        const eu = gente.find(x => x.name === quem);
        if (eu) localStorage.setItem(`racha:${sala}:me`, eu.id); } catch {}
    }, [sala, dados.name, c.quem, dados.people]);
    // js de experiência: roda antes do app, pra poder ouvir o que ele faz
    if (opts.js) await p.addInitScript(opts.js);
    // o navegador roda as animações mais devagar, senão some antes de dar pra ver
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: vel });
    await p.goto(`http://localhost:${porta}/?senha=${dados.name}`);
    // css de experiência: entra depois da folha do app, então redefine keyframes e vence
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
