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
    /** um aparelho no evento, já identificado: `toque` liga o dedo, senão é mouse */
    const aparelho = async ({ toque = true, largura = 390 } = {}) => {
      const ctx = await b.newContext({ viewport: { width: largura, height: 844 }, hasTouch: toque });
      await ctx.route(/fake-db/, r => { const u = r.request().url();
        if (u.includes('/pix/')) return r.fulfill({ json: u.includes('/fernando/') ? 'fernando@exemplo.com' : null });
        if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
        r.fulfill({ json: dados }); });
      const pg = await ctx.newPage(); pg.on('pageerror', e => erros.push(`${toque ? 'dedo' : 'mouse'}: ${e.message}`));
      await pg.goto(`http://localhost:${PORTA}/?senha=${dados.name}`);
      await pg.click('#whoBtn'); await pg.waitForSelector('#whoSel');
      await pg.selectOption('#whoSel', { label: QUEM });
      await pg.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} } }));
      return pg; };

    const p = await aparelho();
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

    // 2. com a piscada montada de verdade — classe e o `animation-delay` inline que o
    //    render deixa no botão — o toque ainda tem que ganhar, e sair do começo
    const p2 = await aparelho();
    await p2.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
    await p2.waitForSelector('#mineRows .ok.pisca', { timeout: 9000 });
    const piscando = await p2.$$eval('#mineRows .ok.pisca', l => l.length);
    exige(piscando > 1, `o teste precisa de mais de uma linha piscando pra valer: ${piscando}`);

    const segunda = p2.locator('#mineRows .row.sub').nth(1).locator('button.ico.ok');
    const atraso = await segunda.evaluate(e => e.style.animationDelay);
    exige(/ms$/.test(atraso), `a piscada tinha que estar montada com atraso inline: "${atraso}"`);
    const cx = await segunda.evaluate(e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await p2.touchscreen.tap(cx[0], cx[1]);
    const est = await segunda.evaluate(e => ({ nome: getComputedStyle(e).animationName,
      atraso: getComputedStyle(e).animationDelay, inline: e.style.animationDelay }));
    exige(est.nome === 'toque', `a piscada ganhou do toque (${est.nome})`);
    exige(est.atraso === '0s', `o toque herdou o atraso da piscada e não começou na hora: ${est.atraso}`);
    console.log('o toque vence a piscada montada:', est.nome === 'toque' && est.atraso === '0s' ? 'ok' : 'FALHOU',
      `| atraso ${atraso} -> ${est.atraso}`);
    await p2.waitForSelector('#okBtn'); await p2.click('#overlay', { position: { x: 5, y: 5 } }); await p2.waitForTimeout(300);

    // 3. tocou num, o convite acabou: as outras linhas param de piscar no render seguinte
    await p2.waitForFunction(() => !document.querySelector('#mineRows .ok.pisca'), null, { timeout: 12000 })
      .catch(() => erros.push('as outras linhas continuaram piscando depois do toque'));
    console.log('o convite acaba no primeiro toque:', erros.length ? 'FALHOU' : 'ok');

    // 4. nota nova, convite novo: trocar de pessoa faz o ✔ pedir de novo
    for (const n of ['Júlia', QUEM]) { await p2.click('#whoBtn'); await p2.waitForSelector('#whoSel');
      await p2.selectOption('#whoSel', { label: n }); await p2.waitForTimeout(200); }
    await p2.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
    const voltou = await p2.waitForSelector('#mineRows .ok.pisca', { timeout: 9000 }).then(() => true).catch(() => false);
    exige(voltou, 'depois de trocar de pessoa o ✔ não voltou a pedir');
    console.log('trocar de pessoa refaz o convite:', voltou ? 'ok' : 'FALHOU');

    // 5. no mouse quem responde é o hover: o clique não monta a animação de toque
    const d = await aparelho({ toque: false, largura: 1280 });
    await d.waitForSelector('#mineRows [data-pix]', { timeout: 9000 });
    await d.click('#mineRows [data-pix]');
    const noMouse = await d.$eval('#mineRows [data-pix]', e => e.classList.contains('tocou'));
    exige(!noMouse, 'o clique de mouse montou a animação de toque');
    console.log('mouse continua no hover:', !noMouse ? 'ok' : 'FALHOU', '| errors:', erros);
  } finally { await b.close(); srv.close(); }
  if (erros.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
