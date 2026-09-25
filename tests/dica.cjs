// O balão que conta o que o ✔ e o copiar pix fazem: aparece uma vez por aparelho,
// atrás das piscadas, dentro do papel, e some sozinho ou no primeiro toque.
const { chromium } = require('./_pw.cjs');
const servir = require('./_serve.cjs');
const { CENAS } = require('./video.cjs');

const PORTA = 4193, QUEM = 'Lia';
const dados = CENAS.dica.dados;   // três dívidas suas, só o Fernando com chave de pix
const H = Date.now();
/** o caso apertado: o primeiro do acerto é nome curto e sem chave de pix, então a dupla
 *  é só o ✔ e fica colada na esquerda — onde um balão centrado nela vazava do papel */
const APERTADO = { name: 'bailedamada',
  people: [{ id: 'lia', name: 'Lia' }, { id: 'ze', name: 'Zé' }, { id: 'ana', name: 'Ana' }],
  expenses: [{ id: 'i1', desc: 'Uber', amount: 40, payer: 'ze', among: ['ze', 'lia'], at: H - 2 * 86400000 },
             { id: 'i2', desc: 'Praia', amount: 60, payer: 'ana', among: ['ana', 'lia'], at: H - 86400000 }] };

(async () => {
  const srv = servir(PORTA); const b = await chromium.launch(); const erros = [];
  const exige = (ok, msg) => { if (!ok) erros.push(msg); return ok; };
  /** um aparelho novo no evento, já identificado */
  const aparelho = async ({ dados: d = dados, largura = 390, ouvindo = false } = {}) => {
    const ctx = await b.newContext({ viewport: { width: largura, height: 844 } });
    await ctx.route(/fake-db/, r => { const u = r.request().url();
      if (u.includes('/pix/')) return r.fulfill({ json: u.includes('/fernando/') ? 'fernando@exemplo.com' : null });
      if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
      r.fulfill({ json: d }); });
    if (ouvindo) await ctx.addInitScript(() => { window.__ev = [];
      addEventListener('animationstart', e => window.__ev.push({ nome: e.animationName, t: Math.round(performance.now()) }), true); });
    const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message));
    await p.goto(`http://localhost:${PORTA}/?senha=${d.name}`);
    await p.click('#whoBtn'); await p.waitForSelector('#whoSel');
    await p.selectOption('#whoSel', { label: QUEM });
    return p; };

  try {
    const p = await aparelho({ ouvindo: true });

    // 1. primeira vez neste aparelho: um balão só, e ele fala dos dois botões
    await p.waitForSelector('.dicaok', { timeout: 9000 });
    const quantos = await p.$$eval('.dicaok', l => l.length);
    const texto = await p.$eval('.dicaok', e => e.textContent);
    const um = exige(quantos === 1, `esperava um balão só, vieram ${quantos}`)
      & exige(/quita/i.test(texto) && /pix/i.test(texto), `o balão não fala dos dois botões: ${texto}`);
    console.log('balão na primeira vez:', um ? 'ok' : 'FALHOU', '|', texto);

    // 2. ele aparece de verdade (não basta estar no DOM), e atrás da última piscada
    await p.waitForFunction(() => { const d = document.querySelector('.dicaok');
      return d && +getComputedStyle(d).opacity > .9; }, null, { timeout: 8000 })
      .catch(() => erros.push('o balão nunca chegou a ficar visível'));
    const ev = await p.evaluate(() => window.__ev);
    const piscas = ev.filter(e => e.nome === 'pisca'), balao = ev.find(e => e.nome === 'balao');
    const atras = exige(piscas.length > 0 && !!balao && balao.t >= piscas[piscas.length - 1].t,
      `o balão não veio atrás das piscadas: piscas em ${piscas.map(e => e.t)}, balão em ${balao && balao.t}`);
    console.log('visível e atrás das piscadas:', atras && !erros.length ? 'ok' : 'FALHOU',
      `| ${piscas.length} piscas, balão em +${balao ? balao.t - piscas[0].t : '?'}ms`);

    // 3. embaixo da linha, com a setinha apontando pra dupla, e dentro do papel
    const medida = p => p.evaluate(() => { const d = document.querySelector('.dicaok');
      const linha = d.closest('.row'), dup = linha.querySelector('.dupla'), ok = linha.querySelector('.dupla > .ok');
      const rd = d.getBoundingClientRect(), rp = dup.getBoundingClientRect(), ro = ok.getBoundingClientRect();
      const rpa = document.querySelector('#app').getBoundingClientRect();
      const seta = parseFloat(getComputedStyle(d, ':before').left);
      return { abaixo: rd.top >= rp.bottom, esq: Math.round(rd.left), dir: Math.round(innerWidth - rd.right),
        noPapel: rd.left >= rpa.left && rd.right <= rpa.right,
        setaEm: Math.round(rd.left + seta), quitarEm: Math.round(ro.left + ro.width / 2),
        naSeta: Math.abs((rd.left + seta) - (ro.left + ro.width / 2)) < 6 }; });
    const m = await medida(p);
    const pos = exige(m.abaixo, `o balão não está embaixo da dupla: ${JSON.stringify(m)}`)
      & exige(m.noPapel && m.esq >= 0 && m.dir >= 0, `o balão vazou: ${JSON.stringify(m)}`)
      & exige(m.naSeta, `a setinha não aponta pro ✔: ${JSON.stringify(m)}`);
    console.log('embaixo, dentro do papel e com a seta no ✔:', pos ? 'ok' : 'FALHOU', JSON.stringify(m));

    // e no caso apertado — nome curto, sem pix, tela de 320 — também não pode vazar
    const ap = await aparelho({ dados: APERTADO, largura: 320 });
    await ap.waitForSelector('.dicaok', { timeout: 9000 });
    const ma = await medida(ap);
    const apertado = exige(ma.noPapel && ma.esq >= 0 && ma.dir >= 0, `o balão vazou no caso apertado: ${JSON.stringify(ma)}`)
      & exige(ma.naSeta, `a setinha não aponta pro ✔ no caso apertado: ${JSON.stringify(ma)}`);
    console.log('320px, nome curto e sem pix:', apertado ? 'ok' : 'FALHOU', JSON.stringify(ma));

    // e no desktop, onde a linha é bem mais larga que o balão, ele tem que andar até o
    // ✔ em vez de ficar no meio da linha — senão a setinha bate no clamp e aponta pro nada
    const dk = await aparelho({ largura: 1440 });
    await dk.waitForSelector('.dicaok', { timeout: 9000 });
    const md = await medida(dk);
    const desktop = exige(md.naSeta, `a setinha não aponta pro ✔ no desktop: ${JSON.stringify(md)}`)
      & exige(md.noPapel, `o balão saiu do papel no desktop: ${JSON.stringify(md)}`);
    console.log('1440px:', desktop ? 'ok' : 'FALHOU', JSON.stringify(md));

    // 4. o toque no ✔ fecha o balão — e o confete continua saindo do botão, não do canto
    const alvo = await p.$eval('#mineRows [data-settle]', e => { const r = e.getBoundingClientRect();
      return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; });
    await p.click('#mineRows [data-settle]'); await p.waitForSelector('#okBtn');
    const fechou = exige(await p.locator('.dicaok').count() === 0, 'o toque no ✔ não fechou o balão');
    await p.click('#okBtn'); await p.waitForTimeout(150);
    const confete = await p.$eval('.confete', e => [Math.round(parseFloat(e.style.left)), Math.round(parseFloat(e.style.top))])
      .catch(() => null);
    const saiu = exige(!!confete && Math.abs(confete[0] - alvo[0]) < 6 && Math.abs(confete[1] - alvo[1]) < 6,
      `o confete não saiu do ✔: botão em ${alvo}, confete em ${confete}`);
    console.log('o toque fecha o balão e o confete sai do ✔:', fechou && saiu ? 'ok' : 'FALHOU', `| ${alvo} vs ${confete}`);

    // 5. o aparelho já viu: recarregar não traz o balão de volta
    const guardou = exige(await p.evaluate(() => localStorage.getItem('racha:viuAcerto') === '1'), 'não guardou o "já viu" no aparelho');
    await p.reload(); await p.waitForSelector('#mineRows [data-settle]', { timeout: 9000 });
    await p.waitForTimeout(3000);
    const devolta = await p.$$eval('.dicaok', l => l.length);
    exige(devolta === 0, `o balão voltou na segunda visita (${devolta})`);
    console.log('segunda visita sem balão:', guardou && devolta === 0 ? 'ok' : 'FALHOU');

    // 6. mas recarregar *antes* de o balão chegar não pode gastar a única vez: quem erra
    //    o nome no "quem é você?" e volta ainda não viu recado nenhum
    const r = await aparelho();
    await r.waitForSelector('#mineRows [data-settle]', { timeout: 9000 });
    await r.reload();
    const insistiu = await r.waitForSelector('.dicaok', { timeout: 9000 }).then(() => true).catch(() => false);
    exige(insistiu, 'recarregar antes de o balão aparecer gastou a única vez');
    console.log('recarregar na espera não gasta a vez:', insistiu ? 'ok' : 'FALHOU');

    // 7. e quem quita *antes* de o balão aparecer não pode vê-lo brotar depois: dispensar
    //    é pra valer, no render logo em seguida, no poll e na visita seguinte
    const c = await aparelho();
    await c.waitForSelector('#mineRows [data-settle]', { timeout: 9000 });
    await c.click('#mineRows [data-settle]'); await c.waitForSelector('#okBtn'); await c.click('#okBtn');
    await c.waitForSelector('#quitOk'); await c.click('#quitOk');
    await c.waitForTimeout(9000);   // passa a hora marcada e ainda um poll inteiro
    const brotou = await c.$$eval('.dicaok', l => l.length);
    exige(brotou === 0, `o balão dispensado voltou depois (${brotou})`);
    await c.reload(); await c.waitForSelector('#mineRows .row', { timeout: 9000 }); await c.waitForTimeout(3000);
    const naVolta = await c.$$eval('.dicaok', l => l.length);
    exige(naVolta === 0, `o balão dispensado voltou na visita seguinte (${naVolta})`);
    console.log('dispensar antes da hora é pra valer:', brotou === 0 && naVolta === 0 ? 'ok' : 'FALHOU', '| errors:', erros);
  } finally { await b.close(); srv.close(); }
  if (erros.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
