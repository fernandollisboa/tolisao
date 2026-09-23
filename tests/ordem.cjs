// A nota se preenche de cima pra baixo, e nada anima fora da tela. A ordem sai de
// relógios espalhados por app.js (fila do agenda, atrasos negativos, carimbo dos
// pagamentos), então é fácil furar sem perceber: aqui ela é medida de verdade,
// ouvindo animationstart, e comparada com a ordem da página.
const { chromium } = require('./_pw.cjs');
const servir = require('./_serve.cjs');
const { CENAS } = require('./video.cjs');

// tela baixa de propósito: o acerto tem que nascer abaixo da dobra, senão não dá
// pra checar que nada anima fora da vista
const PORTA = 4190, QUEM = 'Lia', ALTURA = 420;
const dados = CENAS.cascata.dados;   // três dívidas suas e um pagamento já feito
/** o que tem que acontecer, nesta ordem, cada um depois do anterior */
const ESPERADO = [
  { nome: 'brota', o_que: 'o copiar pix sai de trás do ✔' },
  { nome: 'pisca', o_que: 'os ✔ piscam, um por linha', vezes: 3 },
  { nome: 'volta', o_que: 'as voltas do círculo, duas por linha sua', vezes: 6 },
  { nome: 'risca', o_que: 'o risco do pagamento' },
];

(async () => {
  const srv = servir(PORTA); const b = await chromium.launch(); const erros = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: ALTURA } });
    await ctx.route(/fake-db/, async r => { const u = r.request().url();
      // a chave do pix chega depois do resto, como no mundo real
      if (u.includes('/pix/')) { await new Promise(ok => setTimeout(ok, 1200));
        return r.fulfill({ json: u.includes('/fernando/') ? 'fernando@exemplo.com' : null }); }
      if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
      r.fulfill({ json: dados }); });
    const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(() => { window.__ev = [];
      addEventListener('animationstart', e => { const t = /** @type {any} */ (e.target);
        const row = t.closest && t.closest('.row');
        window.__ev.push({ nome: e.animationName, t: Math.round(performance.now()),
          alvo: row ? (row.textContent || '').trim().slice(0, 24) : (t.id || '') }); }, true); });

    await p.goto(`http://localhost:${PORTA}/#c=${dados.name}`);
    await p.click('#whoBtn'); await p.waitForSelector('#whoSel');
    await p.selectOption('#whoSel', { label: QUEM });

    // ninguém anima antes de chegar na tela: do topo, nada do acerto pode ter corrido
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(2500);
    const dobra = await p.evaluate(() => document.querySelector('#settle').getBoundingClientRect().top - innerHeight);
    if (dobra <= 0) erros.push(`a tela do teste está alta demais: o acerto já aparece (${Math.round(dobra)}px)`);
    const cedo = (await p.evaluate(() => window.__ev)).filter(e => ['volta', 'risca'].includes(e.nome));
    if (cedo.length) erros.push(`animou fora da tela: ${cedo.map(e => e.nome).join(', ')}`);
    console.log('fora da tela nada anima:', !cedo.length && dobra > 0 ? 'ok' : 'FALHOU');

    await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(3500);
    await p.evaluate(() => document.querySelector('#settle').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(4000);

    const nossas = new Set(ESPERADO.map(e => e.nome));
    const ev = (await p.evaluate(() => window.__ev)).filter(e => nossas.has(e.nome));
    const t0 = ev.length ? ev[0].t : 0;
    for (const e of ev) console.log(String(e.t - t0).padStart(6) + 'ms', e.nome.padEnd(7), e.alvo);

    let i = 0;
    for (const passo of ESPERADO) {
      const vezes = passo.vezes || 1;
      const bloco = ev.slice(i, i + vezes);
      if (bloco.length !== vezes || bloco.some(e => e.nome !== passo.nome))
        erros.push(`esperava ${vezes}x "${passo.nome}" (${passo.o_que}) na posição ${i}, veio ${bloco.map(e => e.nome).join(',') || 'nada'}`);
      // dentro do bloco, uma linha atrás da outra; nunca duas ao mesmo tempo
      for (let k = 1; k < bloco.length; k++) if (bloco[k].t < bloco[k-1].t) erros.push(`${passo.nome} fora de ordem`);
      i += vezes;
    }
    if (ev.length > i) erros.push(`sobrou animação depois do fim: ${ev.slice(i).map(e => e.nome).join(', ')}`);
    console.log('ordem de cima pra baixo:', erros.length ? 'FALHOU' : 'ok', '| errors:', erros);
  } finally { await b.close(); srv.close(); }
  if (erros.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
