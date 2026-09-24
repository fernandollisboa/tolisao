// O balão que conta o que o ✔ e o copiar pix fazem: aparece uma vez por aparelho,
// some sozinho e some no primeiro toque.
const { chromium } = require('./_pw.cjs');
const servir = require('./_serve.cjs');
const { CENAS } = require('./video.cjs');

const PORTA = 4193, QUEM = 'Lia';
const dados = CENAS.dica.dados;   // três dívidas suas, só o Fernando com chave de pix

(async () => {
  const srv = servir(PORTA); const b = await chromium.launch(); const erros = [];
  const exige = (ok, msg) => { if (!ok) erros.push(msg); };
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(/fake-db/, r => { const u = r.request().url();
      if (u.includes('/pix/')) return r.fulfill({ json: u.includes('/fernando/') ? 'fernando@exemplo.com' : null });
      if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
      r.fulfill({ json: dados }); });
    const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message));
    await p.goto(`http://localhost:${PORTA}/#c=${dados.name}`);
    await p.click('#whoBtn'); await p.waitForSelector('#whoSel');
    await p.selectOption('#whoSel', { label: QUEM });

    // 1. primeira vez neste aparelho: um balão só, embaixo da dupla de botões
    await p.waitForSelector('.dicaok', { timeout: 9000 });
    const um = await p.$$eval('.dicaok', l => l.length);
    exige(um === 1, `esperava um balão só, vieram ${um}`);
    const texto = await p.$eval('.dicaok', e => e.textContent);
    exige(/quita/i.test(texto) && /pix/i.test(texto), `o balão não fala dos dois botões: ${texto}`);
    console.log('balão na primeira vez:', um === 1 ? 'ok' : 'FALHOU', '|', texto);

    // 2. ele aponta pra baixo, pros botões da primeira linha, e fica por cima da lista
    const pos = await p.evaluate(() => { const d = document.querySelector('.dicaok');
      const dup = d.closest('.dupla'), linha = d.closest('.row');
      const rd = d.getBoundingClientRect(), rp = dup.getBoundingClientRect();
      const primeira = document.querySelector('#mineRows .row.sub') === linha;
      return { abaixo: rd.top >= rp.bottom, centrado: Math.abs((rd.left + rd.width/2) - (rp.left + rp.width/2)) < 2,
        primeira, dentro: rd.left >= 0 && rd.right <= innerWidth }; });
    exige(pos.abaixo && pos.centrado, `o balão não está embaixo da dupla: ${JSON.stringify(pos)}`);
    exige(pos.primeira, 'o balão não saiu na primeira linha do acerto');
    exige(pos.dentro, 'o balão vazou pra fora da tela');
    console.log('embaixo da dupla, centrado e dentro da tela:', pos.abaixo && pos.centrado && pos.dentro ? 'ok' : 'FALHOU');

    // 3. o primeiro toque num dos dois leva o balão embora antes da hora
    await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} } }));
    await p.click('#mineRows [data-pix]');
    await p.waitForSelector('.dicaok', { state: 'detached', timeout: 3000 })
      .catch(() => erros.push('o toque no copiar pix não fechou o balão'));
    console.log('o toque fecha o balão:', erros.length ? 'FALHOU' : 'ok');

    // 4. o aparelho já viu: recarregar não traz o balão de volta
    exige(await p.evaluate(() => localStorage.getItem('racha:viuAcerto') === '1'), 'não guardou o "já viu" no aparelho');
    await p.reload();
    await p.waitForSelector('#mineRows [data-settle]', { timeout: 9000 });
    await p.waitForTimeout(3000);
    const devolta = await p.$$eval('.dicaok', l => l.length);
    exige(devolta === 0, `o balão voltou na segunda visita (${devolta})`);
    console.log('segunda visita sem balão:', devolta === 0 ? 'ok' : 'FALHOU', '| errors:', erros);
  } finally { await b.close(); srv.close(); }
  if (erros.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
