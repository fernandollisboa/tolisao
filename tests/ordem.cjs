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
/** os blocos têm que sair nesta ordem; dentro de um bloco a ordem não importa,
 *  porque a piscada e o copiar pix saem juntos de propósito */
const ESPERADO = [
  { o_que: 'Minha conta: as piscadas dos ✔, uma por linha', bloco: { pisca: 3 } },
  { o_que: 'a linha dos itens virando botão, com o ▸ vazado', bloco: { apertinho: 1, moldura: 1, vazado: 1 } },
  { o_que: 'as voltas do círculo, duas por linha sua', bloco: { volta: 6 } },
  { o_que: 'o risco do pagamento', bloco: { risca: 1 } },
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
        window.__ev.push({ nome: e.animationName, t: Math.round(performance.now()), pseudo: e.pseudoElement || '',
          alvo: row ? (row.textContent || '').trim().slice(0, 24) : (t.id || '') }); }, true); });

    await p.goto(`http://localhost:${PORTA}/?senha=${dados.name}`);
    await p.click('#whoBtn'); await p.waitForSelector('#whoSel');
    await p.selectOption('#whoSel', { label: QUEM });
    // antes de dizer quem é, a nota é outra (sem Minha conta) e anima por conta dela;
    // o que interessa aqui é a sequência de quem já se identificou
    await p.evaluate(() => { window.__ev.length = 0; });

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
    await p.evaluate(() => document.querySelector('#itemsSec').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(2500);
    await p.evaluate(() => document.querySelector('#settle').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(4000);

    // o copiar pix corre por fora da fila de propósito (brota assim que a chave chega),
    // então a posição dele não é fixa: só se cobra que tenha acontecido
    const nossas = new Set(ESPERADO.flatMap(e => Object.keys(e.bloco)));
    // todo render refaz o #mineRows e o #settle, e a animação recomeça do ponto certo
    // pelo atraso negativo — mas dispara animationstart de novo. Só o primeiro conta.
    const vistos = new Set();
    const ev = (await p.evaluate(() => window.__ev)).filter(e => {
      if (!nossas.has(e.nome)) return false;
      const chave = `${e.nome}|${e.alvo}|${e.pseudo}`;
      if (vistos.has(chave)) return false; vistos.add(chave); return true; });
    const t0 = ev.length ? ev[0].t : 0;
    for (const e of ev) console.log(String(e.t - t0).padStart(6) + 'ms', e.nome.padEnd(7), e.alvo);

    const brotou = (await p.evaluate(() => window.__ev)).some(e => e.nome === 'brota');
    if (!brotou) erros.push('o copiar pix não brotou');
    console.log('copiar pix brotou (fora da fila):', brotou ? 'ok' : 'FALHOU');

    let i = 0;
    for (const passo of ESPERADO) {
      const quer = Object.entries(passo.bloco), quantos = quer.reduce((a, [, n]) => a + n, 0);
      const bloco = ev.slice(i, i + quantos), conta = {};
      for (const e of bloco) conta[e.nome] = (conta[e.nome] || 0) + 1;
      const bate = bloco.length === quantos && quer.every(([n, q]) => conta[n] === q);
      if (!bate) erros.push(`esperava ${quer.map(([n, q]) => q + 'x ' + n).join(' + ')} (${passo.o_que}) na posição ${i}, veio ${bloco.map(e => e.nome).join(',') || 'nada'}`);
      i += quantos;
    }
    if (ev.length > i) erros.push(`sobrou animação depois do fim: ${ev.slice(i).map(e => e.nome).join(', ')}`);
    console.log('ordem de cima pra baixo:', erros.length ? 'FALHOU' : 'ok', '| errors:', erros);
  } finally { await b.close(); srv.close(); }
  if (erros.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
