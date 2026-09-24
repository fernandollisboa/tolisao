// Minha conta, a ordem do formulário e o hint de falta/sobra das partes.
const { abre } = require('./_app.cjs');

(async () => {
  const app = await abre({ semente: true, quem: 'Júlia', escala: 2 });
  const p = app.p; const erros = app.erros;
  const exige = (ok, msg) => { if (!ok) erros.push(msg); };
  try {
    p.on('dialog', d => d.accept());
    const conta = (await p.$eval('#mineRows', e => e.innerText)).replace(/\n/g, ' | ');
    console.log('minha conta:', conta);
    exige(/me devem|eu devo|tudo quite/i.test(conta), `Minha conta não diz a situação: ${conta}`);

    // o "sincronizado" fica depois do código de barras, no pé da nota
    exige(await p.evaluate(() => { const st = document.querySelector('#status'), bars = document.querySelector('.bars');
      return !!(bars.compareDocumentPosition(st) & Node.DOCUMENT_POSITION_FOLLOWING); }), 'o status não está no rodapé, depois do código de barras');

    // Júlia anota a janta em partes diferentes: Lia 18,87 + Mengla 23,97 = 42,84
    await p.click('#fab'); await p.waitForSelector('#sheet:not(.hidden)');
    const ordem = await p.$eval('.two', e => [...e.children].map(c => c.id).join(','));
    exige(ordem === 'amount,desc', `o valor tem que vir antes do "o quê?": veio ${ordem}`);
    console.log('ordem do form:', ordem);

    await p.fill('#amount', '42.84'); await p.fill('#desc', 'Janta');
    for (const n of ['Fernando', 'Júlia', 'Klinsmann']) await p.click(`#splitChips label:has-text("${n}")`);
    await p.click('#modeToggle'); await p.waitForSelector('#sharesBox:not(.hidden)');
    await p.fill('#sharesBox input[data-share="lia"]', '18.87');
    await p.fill('#sharesBox input[data-share="mengla"]', '20');
    const hint = await p.$eval('#splitHint', e => e.textContent);
    console.log('hint (sobra/falta):', hint);
    exige(/3,97/.test(hint), `o hint tinha que apontar os R$ 3,97 que faltam: ${hint}`);

    await p.click('#expenseForm button.big'); await p.waitForTimeout(200);
    const toast = await p.$eval('#toast', e => e.textContent);
    exige(/Faltam/.test(toast) && /3,97/.test(toast), `devia barrar dizendo o que falta: ${toast}`);
    exige(await p.isVisible('#sheet:not(.hidden)'), 'o formulário fechou com as partes erradas');
    console.log('bloqueado:', toast);

    await p.fill('#sharesBox input[data-share="mengla"]', '23.97');
    exige(!/Falta|Sobra/.test(await p.$eval('#splitHint', e => e.textContent)), 'o hint continuou reclamando com as partes fechando');
    await p.click('#expenseForm button.big'); await p.waitForSelector('#sheet', { state: 'hidden' });

    const item = await p.$eval('#expenses .row', e => e.innerText);
    exige(/Janta/i.test(item) && /42,84/.test(item), `o item anotado saiu errado: ${item}`);
    console.log('item:', item.replace(/\n/g, ' '));

    // o ÷ de um item dividido por igual abre e fecha a lista de quem divide
    const divisor = p.locator('#expenses [data-among]').first();
    const linha = () => divisor.evaluate(e => e.closest('.small').innerText);
    // o poll refaz a lista o tempo todo: clique de verdade aqui às vezes pega o nó já
    // trocado, o Playwright repete e o toque vira dois. O click() do elemento é um só
    const toca = async () => { await divisor.evaluate(e => e.click()); await p.waitForTimeout(200); };
    const fechado = await linha();
    await toca(); const aberto = await linha();
    exige(/\(.+,.+\)/.test(aberto) && aberto.length > fechado.length, `o ÷ não abriu a lista de quem divide: ${aberto}`);
    await toca();
    const defechado = await linha();
    exige(!/\(.+,.+\)/.test(defechado), `o ÷ não fechou de volta: ${defechado}`);
    console.log('÷ abre e fecha:', /\(.+,.+\)/.test(aberto) && !/\(.+,.+\)/.test(defechado) ? 'ok' : 'FALHOU', '|', aberto);

    const acerto = (await p.$eval('#settle', e => e.innerText)).replace(/\n/g, ' | ');
    console.log('acerto:', acerto);
    exige(/→/.test(acerto), `o acerto não diz quem paga quem: ${acerto}`);

    // Lia abre no aparelho dela, que já esteve no evento antes da janta: vê NOVO no que
    // a Júlia anotou depois da última visita, e a própria linha marcada no acerto
    const antes = Date.now() - 60000;
    const p2 = await app.aba({ quem: 'Lia',
      inicio: `try { localStorage.setItem('racha:${app.sala}:seen', '${antes}'); } catch {}` });
    await p2.waitForTimeout(500);
    const novos = await p2.$$eval('#expenses .tag', l => l.map(e => e.closest('.row').innerText.replace(/\n/g, ' ')));
    exige(novos.length === 1 && /Janta/i.test(novos[0]), `o NOVO tinha que sair só na janta: ${JSON.stringify(novos)}`);
    const minha = await p2.$eval('#settle .row.mine .l', e => e.innerText);
    exige(/^lia\b/i.test(minha), `a linha marcada não é a dela: ${minha}`);
    // a janta entrou na conta dela: o item está na lista e a dívida dela cresceu
    await p2.click('#itemsHead'); await p2.waitForTimeout(150);
    const lista = await p2.$eval('#expenses', e => e.innerText);
    exige(/Janta/i.test(lista) && /18,87/.test(lista), `a janta não apareceu na lista da Lia: ${lista.replace(/\n/g, ' | ')}`);
    console.log('novo:', novos, '| minha linha:', minha);
    console.log('resultado:', erros.length ? 'FALHOU' : 'ok', '| errors:', erros);
  } finally { await app.fecha(); }
  if (erros.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
