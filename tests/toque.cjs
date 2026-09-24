// O toque no ✔ e no copiar pix: no celular não há hover, então o botão se preenche
// e volta. A classe vem do JS, vence a piscada montada, e o mouse não entra nisso.
const { chromium } = require('./_pw.cjs');
const servir = require('./_serve.cjs');
const { CENAS } = require('./video.cjs');

const PORTA = 4195, QUEM = 'Lia';
const dados = CENAS.toque.dados;   // três dívidas suas, só o Fernando com chave de pix

(async () => {
  const srv = servir(PORTA); const b = await chromium.launch(); const erros = [];
  const exige = (ok, msg) => { if (!ok) erros.push(msg); };
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await ctx.route(/fake-db/, r => { const u = r.request().url();
      if (u.includes('/pix/')) return r.fulfill({ json: u.includes('/fernando/') ? 'fernando@exemplo.com' : null });
      if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
      r.fulfill({ json: dados }); });
    const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message));
    await p.goto(`http://localhost:${PORTA}/#c=${dados.name}`);
    await p.click('#whoBtn'); await p.waitForSelector('#whoSel');
    await p.selectOption('#whoSel', { label: QUEM });
    await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} } }));
    await p.waitForSelector('#mineRows [data-pix]', { timeout: 9000 });
    await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(2600);   // as piscadas já acabaram: daqui pra frente é só o toque

    const meio = async sel => { const r = await p.locator(sel).first().boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    const anim = sel => p.$eval(sel, e => getComputedStyle(e).animationName);
    // o botão se enche da cor dele mesmo: a de fundo vira a que era a do texto
    const tons = sel => p.$eval(sel, e => { const c = getComputedStyle(e); return { fundo: c.backgroundColor, tinta: c.color }; });

    // 1. o toque preenche o botão com a cor dele: o ✔ de verde, o copiar pix de tinta
    for (const [sel, nome] of [['#mineRows [data-pix]', 'copiar pix'], ['#mineRows [data-settle]', '✔']]) {
      const parado = await tons(sel);
      const o = await meio(sel);
      await p.touchscreen.tap(o.x, o.y);
      const cheio = await tons(sel), qual = await anim(sel);
      exige(qual === 'toque', `${nome}: esperava a animação toque, veio ${qual}`);
      exige(cheio.fundo === parado.tinta, `${nome}: encheu de ${cheio.fundo}, esperava a cor dele (${parado.tinta})`);
      exige(cheio.tinta === parado.fundo, `${nome}: a tinta não virou o papel (${cheio.tinta}, esperava ${parado.fundo})`);
      console.log(`toque no ${nome}:`, qual === 'toque' && cheio.fundo === parado.tinta ? 'ok' : 'FALHOU', `| fundo ${parado.fundo} -> ${cheio.fundo}`);
      // e volta sozinho: a classe sai quando a animação acaba
      await p.waitForFunction(s => !document.querySelector(s).classList.contains('tocou'), sel, { timeout: 2000 })
        .catch(() => erros.push(`${nome}: a classe tocou não saiu no fim da animação`));
      if (sel.includes('settle')) { await p.waitForSelector('#okBtn'); await p.click('#overlay', { position: { x: 5, y: 5 } }); await p.waitForTimeout(300); }
    }

    // 2. o toque vence a piscada montada, sem !important
    await p.evaluate(() => document.querySelector('#mineRows [data-settle]').classList.add('pisca'));
    exige(await anim('#mineRows [data-settle]') === 'pisca', 'a piscada não montou pra valer no teste');
    const o = await meio('#mineRows [data-settle]');
    await p.touchscreen.tap(o.x, o.y);
    const venceu = await anim('#mineRows [data-settle]');
    exige(venceu === 'toque', `a piscada ganhou do toque (${venceu})`);
    console.log('o toque vence a piscada:', venceu === 'toque' ? 'ok' : 'FALHOU');
    await p.waitForSelector('#okBtn'); await p.click('#overlay', { position: { x: 5, y: 5 } }); await p.waitForTimeout(300);

    // 3. no mouse quem responde é o hover: o clique não monta a animação de toque
    const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx2.route(/fake-db/, r => { const u = r.request().url();
      if (u.includes('/pix/')) return r.fulfill({ json: u.includes('/fernando/') ? 'fernando@exemplo.com' : null });
      if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
      r.fulfill({ json: dados }); });
    const d = await ctx2.newPage(); d.on('pageerror', e => erros.push('desktop ' + e.message));
    await d.goto(`http://localhost:${PORTA}/#c=${dados.name}`);
    await d.click('#whoBtn'); await d.waitForSelector('#whoSel'); await d.selectOption('#whoSel', { label: QUEM });
    await d.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} } }));
    await d.waitForSelector('#mineRows [data-pix]', { timeout: 9000 });
    await d.click('#mineRows [data-pix]');
    const noMouse = await d.$eval('#mineRows [data-pix]', e => e.classList.contains('tocou'));
    exige(!noMouse, 'o clique de mouse montou a animação de toque');
    console.log('mouse continua no hover:', !noMouse ? 'ok' : 'FALHOU', '| errors:', erros);
  } finally { await b.close(); srv.close(); }
  if (erros.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
