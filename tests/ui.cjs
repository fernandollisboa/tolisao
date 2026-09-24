// Anotar pelo ✎, quitar, o "ver todos", e a página não estourar a largura.
const { abre } = require('./_app.cjs');

(async () => {
  const app = await abre({ semente: true, quem: 'Lia', escala: 2 });
  const p = app.p; const erros = app.erros;
  const exige = (ok, msg) => { if (!ok) erros.push(msg); };
  const conta = sel => p.$$eval(sel, l => l.length);
  try {
    /** @type {string[]} */ const perguntas = [];
    p.on('dialog', d => { perguntas.push(d.message()); d.type() === 'prompt' ? d.accept('Zé') : d.accept(); });

    // as duas seções contam a mesma história: um ✔ em Minha conta por linha sua no acerto
    const quitaveis = await conta('#mineRows [data-settle]');
    const minhas = await conta('#settle .row.mine:not(.paid)');
    const abertas = await conta('#settle .row:not(.paid)');
    const itens = await conta('#expenses .row');
    exige(quitaveis === minhas, `${quitaveis} botão de quitar pra ${minhas} linha(s) sua(s) no acerto`);
    exige(quitaveis > 0 && abertas >= quitaveis, `acerto vazio demais pro teste: ${quitaveis}/${abertas}`);
    console.log('quitar:', quitaveis, '| linhas do acerto:', abertas, '| itens:', itens, '| toggle:', await p.$eval('#toggleAll', e => e.textContent));

    // o cabeçalho e a lista contam a mesma coisa, e até 10 itens não precisa do "ver todos"
    const cabecalho = await p.$eval('#itemsCount', e => e.textContent);
    exige(parseInt(cabecalho, 10) === itens, `o cabeçalho diz "${cabecalho}" e a lista mostra ${itens}`);
    exige(itens <= 10 && await p.$eval('#toggleAll', e => e.classList.contains('hidden')),
      `com ${itens} itens o "ver todos" não devia aparecer`);

    // quitei a primeira linha: some uma linha aberta, entra um pagamento na lista
    await p.click('#mineRows [data-settle]'); await p.waitForSelector('#okBtn');
    await p.click('#okBtn'); await p.waitForSelector('#quitOk'); await p.click('#quitOk'); await p.waitForTimeout(300);
    const depois = await conta('#settle .row:not(.paid)');
    exige(depois === abertas - 1, `quitar devia tirar uma linha do acerto: ${abertas} -> ${depois}`);
    exige(await conta('#settle .row.paid') === 1, 'o pagamento não virou linha riscada no acerto');
    exige(await conta('#mineRows [data-settle]') === quitaveis - 1, 'o ✔ da linha quitada continuou lá');
    // quitação não é gasto: ela risca no acerto e fica fora da lista de itens
    exige(await conta('#expenses .row') === itens, 'a quitação entrou na lista de itens, e ela não é um gasto');
    console.log('depois de quitar:', depois, 'linhas abertas, ainda', itens, 'itens');

    // nada pode furar a largura da tela
    const [scroll, tela] = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    exige(scroll <= tela, `a página estourou a largura: ${scroll}/${tela}`);
    console.log('scrollWidth/innerWidth:', `${scroll}/${tela}`);

    // a lista de gente está atrás da constante MEMBROS; revelamos pra exercitar o +
    await p.evaluate(() => document.getElementById('peopleSec').classList.remove('hidden'));
    await p.click('#addPerson'); await p.waitForSelector('#askInput');
    await p.fill('#askInput', 'Zé'); await p.click('#askForm button.big'); await p.waitForTimeout(300);
    const gente = await p.$eval('#peopleLine', e => e.innerText);
    exige(/Zé/i.test(gente), `o Zé não entrou na lista: ${gente}`);
    console.log('gente:', gente);

    // anotar pelo ✎
    await p.click('#fab'); await p.waitForSelector('#sheet:not(.hidden)');
    await p.fill('#desc', 'Cerveja'); await p.fill('#amount', '50'); await p.click('#expenseForm button');
    await p.waitForSelector('#sheet', { state: 'hidden' });
    const topo = await p.$eval('#expenses .row', e => e.innerText.replace(/\n/g, ' '));
    exige(/Cerveja/i.test(topo) && /50,00/.test(topo), `o gasto anotado não ficou no topo: ${topo}`);
    console.log('anotado pelo ✎:', topo);

    // e o segundo aparelho vê tudo isso sem ninguém mandar nada
    const p2 = await app.aba({ quem: 'Lia' });
    await p2.waitForTimeout(500);
    const lista2 = (await p2.$eval('#expenses', e => e.innerText)).toUpperCase();
    exige(lista2.includes('CERVEJA'), 'o outro aparelho não viu a cerveja');
    const aqui = await conta('#settle .row:not(.paid)'), la = await p2.$$eval('#settle .row:not(.paid)', l => l.length);
    exige(la === aqui, `o acerto chegou diferente no outro aparelho: ${aqui} aqui, ${la} lá`);
    const pagadores = await p2.$$eval('#payer option', l => l.map(o => o.textContent).join(', '));
    exige(/Zé/i.test(pagadores), `o Zé não chegou no outro aparelho: ${pagadores}`);
    console.log('o outro aparelho vê a cerveja, o Zé e as mesmas', la, 'linhas de acerto');

    exige(perguntas.length === 0, `apareceu diálogo do navegador: ${perguntas.join(' | ')}`);
    console.log('resultado:', erros.length ? 'FALHOU' : 'ok', '| errors:', erros);
  } finally { await app.fecha(); }
  if (erros.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
