// o que a sessão de QA da #35 pediu: a linha dos itens convida com verbo e perde a
// moldura aberta, os botões do acerto dizem o que fazem, a caixa do caderno em branco
// abre o anotar, e o cartão do evento tem voltar
const { chromium } = require('./_pw.cjs');
const servir = require('./_serve.cjs');
const { DADOS } = require('./preview.cjs');

const PORTA = 4196;
const VAZIO = { name: 'churras', people: DADOS.people.slice(0, 3), expenses: [] };

(async () => {
  const srv = servir(PORTA); const b = await chromium.launch(); const erros = [];
  const exige = (ok, msg) => { if (!ok) erros.push(msg); return ok; };
  const abre = async (d, quem, toque = false) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: toque, isMobile: toque });
    await ctx.route(/fake-db/, r => { const u = r.request().url();
      if (u.includes('/pix/')) return r.fulfill({ json: u.includes('/fernando/') ? 'fernando@exemplo.com' : null });
      if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
      r.fulfill({ json: d }); });
    const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message));
    await p.goto(`http://localhost:${PORTA}/?senha=${d.name}`);
    await p.click('#whoBtn'); await p.waitForSelector('#whoSel'); await p.selectOption('#whoSel', { label: quem });
    await p.waitForTimeout(400); return p; };
  const itens = p => p.$eval('#itemsCount', e => e.textContent);
  const moldura = p => p.$eval('#itemsHead', e => getComputedStyle(e, '::before').display);

  const p = await abre(DADOS, 'Lia');
  exige(await itens(p) === 'ver os 3 itens', `linha dos itens sem verbo: "${await itens(p)}"`);
  exige(await moldura(p) !== 'none', 'fechada, a linha dos itens devia ter moldura');
  await p.click('#itemsHead');
  exige(await itens(p) === '3 itens', `aberta, a linha devia virar contagem: "${await itens(p)}"`);
  exige(await moldura(p) === 'none', 'aberta, a linha dos itens não devia ter moldura');
  await p.click('#itemsHead');
  exige(await itens(p) === '3 itens', 'depois de abrir uma vez, o verbo não devia voltar na mesma sessão');
  exige(await moldura(p) !== 'none', 'fechada de novo, a moldura devia voltar');
  // outra pessoa é nota nova: convida de novo
  await p.click('#whoBtn'); await p.waitForSelector('#whoSel'); await p.selectOption('#whoSel', { label: 'Mengla' }); await p.waitForTimeout(300);
  exige(await itens(p) === 'ver os 3 itens', `trocar de pessoa devia convidar de novo: "${await itens(p)}"`);
  // e pelo teclado: foco na linha, Enter abre, e o leitor de tela sabe que abriu
  await p.focus('#itemsHead'); await p.keyboard.press('Enter');
  exige(await p.$eval('#itemsHead', e => e.getAttribute('aria-expanded')) === 'true', 'Enter na linha dos itens não abriu');
  await p.keyboard.press(' ');
  exige(await p.$eval('#itemsHead', e => e.getAttribute('aria-expanded')) === 'false', 'Espaço na linha dos itens não fechou');
  console.log('linha dos itens: ver os 3 itens → 3 itens, moldura só fechada, convida de novo com outra pessoa');

  await p.waitForSelector('#mineRows [data-pix]', { timeout: 8000 });
  const botoes = await p.$$eval('#mineRows .dupla > button', l => l.map(b => b.textContent.trim()));
  exige(botoes.includes('✔ paguei') && botoes.includes('copiar pix'), `botões do acerto sem nome: ${JSON.stringify(botoes)}`);
  exige(await p.locator('.dicaok').count() === 0, 'o balão do acerto devia ter saído');
  // a área de toque maior é só do dedo: no mouse ela acendia o hover longe do botão
  const area = pg => pg.$eval('#mineRows .dupla > button', b => { const a = getComputedStyle(b, '::after'); return a.content === 'none' ? b.getBoundingClientRect().height : b.getBoundingClientRect().height + parseFloat(a.top) * -2; });
  const dedo = await abre(DADOS, 'Lia', true); await dedo.waitForSelector('#mineRows .dupla > button');
  const alvo = await area(dedo), mouse = await area(p);
  exige(alvo >= 44, `área de toque do ✔ com ${alvo}px, menos que 44`);
  exige(mouse < 30, `no mouse a área do ✔ devia ser a do botão, veio ${mouse}px`);
  console.log('botões do acerto:', botoes.join(' · '), `| área de toque ${alvo}px`);

  await p.click('#roomLabel'); await p.waitForSelector('#evBack');
  const ordem = await p.$$eval('#overlayBox button', l => l.map(b => b.id));
  exige(ordem.indexOf('evBack') < ordem.indexOf('evLeave'), `voltar devia vir antes do sair: ${ordem}`);
  await p.click('#evBack');
  exige(await p.$eval('#overlay', e => e.classList.contains('hidden')), 'o voltar do cartão do evento não fechou');
  console.log('cartão do evento: voltar em cima do sair, e fecha');

  // valor como no app do banco: os dígitos entram pelos centavos, e apagar tira o último
  await p.click('#fab'); await p.waitForSelector('#sheet:not(.hidden)');
  const valores = [];
  for (const t of ['5', '0', '0', '0']) { await p.type('#amount', t); valores.push(await p.inputValue('#amount')); }
  await p.press('#amount', 'Backspace'); valores.push(await p.inputValue('#amount'));
  // teto de 9 dígitos (9.999.999,99): o que passa disso não entra
  for (const t of '1234567') await p.type('#amount', t); valores.push(await p.inputValue('#amount'));
  exige(JSON.stringify(valores) === JSON.stringify(['0,05', '0,50', '5,00', '50,00', '5,00', '5.001.234,56']), `máscara do valor: ${JSON.stringify(valores)}`);
  await p.fill('#amount', ''); await p.click('#sheetClose');
  console.log('valor digitado pelos centavos:', valores.join(' → '));

  const v = await abre(VAZIO, 'Lia');
  exige(await v.locator('#dica').count() === 0, 'o balão do ✎ devia ter saído (ele tapava o cabeçalho)');
  await v.click('#settle .empty.anota');
  exige(!(await v.$eval('#sheet', e => e.classList.contains('hidden'))), 'tocar na caixa do caderno em branco não abriu o anotar');
  console.log('caderno em branco: a caixa abre o anotar');

  await b.close(); srv.close();
  if (erros.length) { console.error('nota: FALHOU', erros); process.exit(1); }
  console.log('nota: ok');
})().catch(e => { console.error(e); process.exit(1); });
