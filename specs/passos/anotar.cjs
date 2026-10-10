const { Given, When, Then, expect, idDe, AGORA } = require('./_mundo.cjs');

const dinheiro = v => v.toFixed(2).replace('.', ',');
const moldura = p => p.$eval('#itemsHead', e => getComputedStyle(e, '::before').display);
// a marca de novo/mudou vem colada na frente do nome do item
const item = (p, nome) => p.locator('#expenses .item[data-item]').filter({ has: p.locator('.row .l', { hasText: new RegExp(`^(?:novo|mudou)?\\s*${nome.replace(/[()]/g, '\\$&')}$`) }) });

Then('a lista tem {int} itens', async ({ mundo }, n) => { await expect(mundo.p.locator('#expenses .item[data-item]')).toHaveCount(n); });
Then('o primeiro item da lista é {string} de {word}', async ({ mundo }, nome, valor) => {
  const r = mundo.p.locator('#expenses .item').first().locator('.row');
  await expect(r.locator('.l')).toHaveText(nome); await expect(r.locator('.v')).toHaveText(valor);
});
Then('o "ver todos" não aparece, porque cabe tudo', async ({ mundo }) => { await expect(mundo.p.locator('#toggleAll')).toBeHidden(); });
Then('o ✎ está/continua chamando', async ({ mundo }) => { await expect(mundo.p.locator('#fab')).toHaveClass(/\bchamando\b/); });

When('eu abro a lista de itens', async ({ mundo }) => { await mundo.p.click('#itemsHead'); await expect(mundo.p.locator('#expenses .item').first()).toBeVisible(); });
When('eu toco no ÷ do {string}', async ({ mundo }, nome) => { await item(mundo.p, nome).locator('[data-among]').click(); await mundo.p.mouse.move(0, 0); });
Then('o {string} mostra quem divide: {string}', async ({ mundo }, nome, txt) => {
  const it = item(mundo.p, nome); await expect(it).toHaveClass(/\bopen\b/);
  await expect(it.locator('.who')).toBeVisible(); await expect(it.locator('.small')).toContainText(txt);
});
Then('o {string} esconde quem divide', async ({ mundo }, nome) => {
  const it = item(mundo.p, nome); await expect(it).not.toHaveClass(/\bopen\b/); await expect(it.locator('.who')).toBeHidden();
});

When('eu toco no ✎', async ({ mundo }) => { await mundo.p.click('#fab'); await mundo.p.waitForSelector('#sheet:not(.hidden)'); });
Then('o anotar fecha', async ({ mundo }) => { await expect(mundo.p.locator('#sheet')).toHaveClass(/\bhidden\b/); });
Then('o ✎ fica com o foco', async ({ mundo }) => { await expect(mundo.p.locator('#fab')).toBeFocused(); });
When('eu anoto {string} de R$ {num} dividido igualmente', async ({ mundo }, desc, valor) => {
  const p = mundo.p; await p.click('#fab'); await p.waitForSelector('#sheet:not(.hidden)');
  await p.fill('#amount', dinheiro(valor)); await p.fill('#desc', desc); await p.click('#expenseForm button.big');
  await p.waitForSelector('#sheet', { state: 'hidden' });
});
Then('o formulário pede primeiro o valor e depois o quê', async ({ mundo }) => {
  expect(await mundo.p.$eval('.two', e => [...e.children].map(c => c.id))).toEqual(['amount', 'desc']);
});
When('eu preencho R$ {num} de {string}', async ({ mundo }, valor, desc) => { await mundo.p.fill('#amount', dinheiro(valor)); await mundo.p.fill('#desc', desc); });
// deixa marcados nos chips só os nomes da lista
const marcaSo = async (mundo, gente) => {
  const quero = new Set(gente.map(n => mundo.pessoa(n).id));
  for (const chip of await mundo.p.locator('#splitChips input').all()) if ((await chip.isChecked()) !== quero.has(await chip.inputValue())) await chip.locator('xpath=..').click();
};
When('eu divido só entre {gente}, em partes diferentes', async ({ mundo }, gente) => {
  await marcaSo(mundo, gente);
  await mundo.p.click('#splitSeg [data-modo="custom"]'); await mundo.p.waitForSelector('#sharesBox:not(.hidden)');
});
When('eu ponho R$ {num} pra {word}', async ({ mundo }, v, n) => { await mundo.p.fill(`#sharesBox input[data-share="${mundo.pessoa(n).id}"]`, dinheiro(v)); });
When('eu ponho R$ {num} pra {word} e R$ {num} pra {word}', async ({ mundo }, v1, n1, v2, n2) => {
  for (const [v, n] of [[v1, n1], [v2, n2]]) await mundo.p.fill(`#sharesBox input[data-share="${mundo.pessoa(n).id}"]`, dinheiro(v));
});
Then('o formulário diz que faltam R$ {num}', async ({ mundo }, v) => { await expect(mundo.p.locator('#falta')).toHaveText(new RegExp(`faltam R\\$\\s${dinheiro(v)}`)); });
Then('o formulário diz que fechou', async ({ mundo }) => { await expect(mundo.p.locator('#falta')).toHaveText(/fechou/); });
Then('ainda não dá pra anotar', async ({ mundo }) => { await expect(mundo.p.locator('#expenseForm button.big')).toBeDisabled(); });
Then('já dá pra anotar', async ({ mundo }) => { await expect(mundo.p.locator('#expenseForm button.big')).toBeEnabled(); });

When('eu digito no valor, tecla por tecla:', async ({ mundo }, tabela) => {
  for (const { tecla, fica } of tabela.hashes()) { await mundo.p.type('#amount', tecla); await expect(mundo.p.locator('#amount')).toHaveValue(fica); }
});
When('eu apago o último dígito', async ({ mundo }) => { await mundo.p.press('#amount', 'Backspace'); });
When('eu digito {string} no valor', async ({ mundo }, txt) => { await mundo.p.type('#amount', txt); });
Then('o valor fica {string}', async ({ mundo }, v) => { await expect(mundo.p.locator('#amount')).toHaveValue(v); });

Then('a frase de como está dividido vem antes das abas', async ({ mundo }) => {
  expect(await mundo.p.$eval('#splitHint', h => !!(h.compareDocumentPosition(document.querySelector('#splitSeg')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
});
Then('a frase de como está dividido diz {string}', async ({ mundo }, txt) => {
  await expect.poll(() => mundo.p.$eval('#splitHint', h => h.innerText.replace(/\u00a0/g, ' ').trim())).toBe(txt);
});
Then('o cursor continua no valor', async ({ mundo }) => { await expect(mundo.p.locator('#amount')).toBeFocused(); });
When('eu divido só com {gente}', async ({ mundo }, gente) => {
  await marcaSo(mundo, gente);
});
When('eu anoto {string} e depois {string}, os dois de R$ {num} divididos igualmente', async ({ mundo }, a, b, valor) => {
  for (const desc of [a, b]) {
    const p = mundo.p; await p.click('#fab'); await p.waitForSelector('#sheet:not(.hidden)');
    await p.fill('#amount', dinheiro(valor)); await p.fill('#desc', desc); await p.click('#expenseForm button.big');
    // o segundo, de mesmo valor e mesmo pagador, cai no "já anotaram?": anota mesmo assim
    if (desc === b) await p.click('#okBtn');
    await p.waitForSelector('#sheet', { state: 'hidden' });
  }
});
const quemLeva = (mundo, desc) => {
  const e = (mundo.banco.arvore.rooms[mundo.sala]?.expenses || []).find(x => x.desc === desc);
  if (!e) return undefined;
  // sem partes gravadas, a divisão igual põe o centavo no primeiro da turma
  if (!e.shares) return e.among[0];
  const max = Math.max(...Object.values(e.shares)); return Object.keys(e.shares).find(id => e.shares[id] === max);
};
Then('no banco, o centavo a mais do {string} e o do {string} ficam com pessoas diferentes', async ({ mundo }, a, b) => {
  await expect.poll(() => [quemLeva(mundo, a), quemLeva(mundo, b)].every(Boolean)).toBe(true);
  expect(quemLeva(mundo, a)).not.toBe(quemLeva(mundo, b));
});
// guarda quem levava o centavo antes da edição, pro Então comparar
When('eu troco a descrição do {string} pra {string} e salvo', async ({ mundo }, velha, nova) => {
  await expect.poll(() => quemLeva(mundo, velha)).toBeTruthy();
  mundo.centavoAntes = quemLeva(mundo, velha);
  await mundo.p.fill('#desc', nova); await mundo.p.click('#expenseForm button.big'); await mundo.p.waitForSelector('#sheet', { state: 'hidden' });
});
Then('no banco, o centavo a mais do {string} continua com a mesma pessoa', async ({ mundo }, desc) => {
  await expect.poll(() => quemLeva(mundo, desc)).toBe(mundo.centavoAntes);
});
Then('a aba igual fica marcada', async ({ mundo }) => {
  const aba = mundo.p.locator('#splitSeg [data-modo="equal"]'); await expect(aba).toHaveClass(/\bon\b/); await expect(aba).toHaveAttribute('aria-selected', 'true');
});
When('eu começo a digitar a parte do {word}', async ({ mundo }, n) => { await mundo.p.focus(`#sharesBox input[data-share="${mundo.pessoa(n).id}"]`); });
When('a nota sincroniza', async ({ mundo }) => {
  // o sync reescreve o #status mesmo quando o texto é igual: é assim que se sabe que ele passou
  await mundo.p.evaluate(() => new Promise(ok => {
    const o = new MutationObserver(() => { o.disconnect(); ok(); });
    o.observe(document.querySelector('#status'), { childList: true });
    document.dispatchEvent(new Event('visibilitychange')); }));
});
Then('o cursor continua na parte do {word}', async ({ mundo }, n) => {
  await expect(mundo.p.locator(`#sharesBox input[data-share="${mundo.pessoa(n).id}"]`)).toBeFocused();
});
When('eu toco na aba igual', async ({ mundo }) => { await mundo.p.click('#splitSeg [data-modo="equal"]'); });
Then('todo mundo divide, com as partes vazias', async ({ mundo }) => {
  const campos = mundo.p.locator('#sharesBox input[data-share]');
  await expect(campos).toHaveCount(await mundo.p.locator('#splitChips input').count());
  for (const c of await campos.all()) await expect(c).toHaveValue('');
});
When('eu toco na aba das partes diferentes', async ({ mundo }) => { await mundo.p.click('#splitSeg [data-modo="custom"]'); });
Then('a aba das partes diferentes fica marcada', async ({ mundo }) => {
  const aba = mundo.p.locator('#splitSeg [data-modo="custom"]'); await expect(aba).toHaveClass(/\bon\b/); await expect(aba).toHaveAttribute('aria-selected', 'true');
});
Then('os chips de quem divide somem', async ({ mundo }) => { await expect(mundo.p.locator('#splitChips')).toHaveClass(/\bhidden\b/); });
When('eu toco em "dividir o resto igual"', async ({ mundo }) => { await mundo.p.click('#restoIgual'); });
Then('as partes ficam:', async ({ mundo }, tabela) => {
  for (const { pessoa, parte } of tabela.hashes()) await expect(mundo.p.locator(`#sharesBox input[data-share="${mundo.pessoa(pessoa).id}"]`)).toHaveValue(parte);
});
When('eu tiro o/a {word} da divisão', async ({ mundo }, n) => {
  await mundo.p.locator('#sharesBox .lin').filter({ has: mundo.p.locator(`input[data-share="${mundo.pessoa(n).id}"]`) }).locator('.ck').click();
});
Then('o/a {word} sai também dos chips de quem divide', async ({ mundo }, n) => { await expect(mundo.p.locator(`#splitChips input[value="${mundo.pessoa(n).id}"]`)).not.toBeChecked(); });
When('eu apago a parte do/da {word} e toco em "o resto" nela', async ({ mundo }, n) => {
  const id = mundo.pessoa(n).id; await mundo.p.fill(`#sharesBox input[data-share="${id}"]`, ''); await mundo.p.click(`#sharesBox [data-resto="${id}"]:not(.hidden)`);
});
Then('a parte do/da {word} fica {string}', async ({ mundo }, n, v) => { await expect(mundo.p.locator(`#sharesBox input[data-share="${mundo.pessoa(n).id}"]`)).toHaveValue(v); });

Then('a linha dos itens diz {string}, com moldura', async ({ mundo }, txt) => {
  await expect(mundo.p.locator('#itemsCount')).toHaveText(txt); expect(await moldura(mundo.p)).not.toBe('none');
});
Then('a linha dos itens diz {string}, sem moldura', async ({ mundo }, txt) => {
  await expect(mundo.p.locator('#itemsCount')).toHaveText(txt); expect(await moldura(mundo.p)).toBe('none');
});
When('eu toco na linha dos itens', async ({ mundo }) => { await mundo.p.click('#itemsHead'); });
When('eu aperto Enter na linha dos itens', async ({ mundo }) => { await mundo.p.focus('#itemsHead'); await mundo.p.keyboard.press('Enter'); });
When('eu aperto Espaço na linha dos itens', async ({ mundo }) => { await mundo.p.focus('#itemsHead'); await mundo.p.keyboard.press(' '); });
Then('a lista de itens está aberta', async ({ mundo }) => { await expect(mundo.p.locator('#itemsHead')).toHaveAttribute('aria-expanded', 'true'); });
Then('a lista de itens está fechada', async ({ mundo }) => { await expect(mundo.p.locator('#itemsHead')).toHaveAttribute('aria-expanded', 'false'); });
When('eu salvo', async ({ mundo }) => { await mundo.p.click('#expenseForm button.big'); });
Then('embaixo dele está escrito {string}', async ({ mundo }, txt) => {
  await mundo.p.mouse.move(0, 0);
  await expect.poll(() => mundo.p.locator('#expenses .item').first().locator('.small > span').evaluate(e => e.innerText.replace(/\u00a0/g, ' ').trim())).toBe(txt);
});
Then('a lista fica separada em {int} dias', async ({ mundo }, n) => { await expect(mundo.p.locator('#expenses .day')).toHaveCount(n); });

When('eu apago o {string}', async ({ mundo }, nome) => { await item(mundo.p, nome).getByRole('button', { name: `excluir o gasto ${nome}` }).click(); await mundo.p.click('#okBtn'); });
Then('o {string} aparece riscado, apagado por {word}', async ({ mundo }, nome, quem) => {
  const r = mundo.p.locator('#gone .item.apagado').filter({ hasText: nome });
  await expect(r.locator('.row .l')).toHaveCSS('text-decoration-line', 'line-through');
  await expect(r.locator('.small')).toContainText(`apagado por ${quem}`);
});
Then('o fim da lista diz {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#goneToggle')).toHaveText(txt); });
Then('a {string} de {word} aparece riscada: {string}', async ({ mundo }, nome, v, txt) => {
  const r = mundo.p.locator('#gone .item.apagado').filter({ hasText: nome });
  await expect(r.locator('.row .l')).toHaveCSS('text-decoration-line', 'line-through');
  await expect(r.locator('.row .v')).toHaveText(v);
  await expect(r.locator('.small')).toContainText(txt);
});
When('eu abro os itens apagados', async ({ mundo }) => { await mundo.p.click('#goneToggle'); });
Then('nenhum item aparece riscado', async ({ mundo }) => { await expect(mundo.p.locator('.item.apagado')).toHaveCount(0); });
Then('o total dos itens fica {word}', async ({ mundo }, v) => { await expect(mundo.p.locator('#total')).toContainText(v); });
When('eu edito o {string}', async ({ mundo }, nome) => {
  const it = item(mundo.p, nome); await it.locator('.row .l').click(); await it.locator('[data-edit-expense]').click();
  await mundo.p.waitForSelector('#sheet:not(.hidden)');
});
Then('o formulário vem com R$ {num} de {string}', async ({ mundo }, v, desc) => {
  await expect(mundo.p.locator('#amount')).toHaveValue(dinheiro(v)); await expect(mundo.p.locator('#desc')).toHaveValue(desc);
  await expect(mundo.p.locator('#sheet h2')).toHaveText('Editar');
});
When('eu troco o valor pra R$ {num} e salvo', async ({ mundo }, v) => {
  await mundo.p.fill('#amount', dinheiro(v)); await mundo.p.click('#expenseForm button.big'); await mundo.p.waitForSelector('#sheet', { state: 'hidden' });
});
Then('o {string} fica de {word}', async ({ mundo }, nome, v) => { await expect(item(mundo.p, nome).locator('.row .v')).toHaveText(v); });
When('eu fecho o anotar', async ({ mundo }) => { await mundo.p.click('#sheetClose'); await mundo.p.waitForSelector('#sheet', { state: 'hidden' }); });
Then('o formulário vem vazio, pra anotar', async ({ mundo }) => {
  await expect(mundo.p.locator('#amount')).toHaveValue(''); await expect(mundo.p.locator('#desc')).toHaveValue('');
  await expect(mundo.p.locator('#sheet h2')).toHaveText('Anotar'); await expect(mundo.p.locator('#expenseForm button.big')).toHaveText('Anotar');
});

const excluir = async (p, nome) => { const it = item(p, nome); await it.locator('.row .l').click(); await it.getByRole('button', { name: `excluir o gasto ${nome}` }).click(); await p.waitForSelector('#okBtn'); };
When('eu começo a excluir o {string} e volto atrás', async ({ mundo }, nome) => { await excluir(mundo.p, nome); await mundo.p.click('#cancelBtn'); await mundo.p.waitForSelector('#overlay', { state: 'hidden' }); });
When('eu excluo o {string}', async ({ mundo }, nome) => { await excluir(mundo.p, nome); await mundo.p.click('#okBtn'); });
Then('o {string} não está na lista', async ({ mundo }, nome) => { await expect(item(mundo.p, nome)).toHaveCount(0); });

When('outro aparelho anota {string} de R$ {num} bem na hora que eu gravo o {string}', async ({ mundo }, desc, valor, meu) => {
  const lia = mundo.pessoa('Lia').id;
  mundo.banco.noMeio = (sala, novo) => {
    if (!(novo?.expenses || []).some(e => e.desc === meu)) return false;
    const atual = mundo.banco.arvore.rooms[sala];
    atual.expenses = [...(atual.expenses || []), { id: 'dooutro', desc, amount: valor, payer: lia, among: [lia], at: Date.now() }];
    return true;
  };
});
Then('o banco tem os itens {string} e {string}', async ({ mundo }, a, b) => {
  await expect.poll(() => (mundo.banco.arvore.rooms[mundo.sala]?.expenses || []).map(e => e.desc)).toEqual(expect.arrayContaining([a, b]));
});

// o outro aparelho grava direto no banco; este só fica sabendo no próximo sync, o de quando eu gravo
const salaNoBanco = mundo => mundo.banco.arvore.rooms[mundo.sala];
When('outro aparelho anota:', async ({ mundo }, tabela) => {
  const sala = salaNoBanco(mundo), id = n => mundo.pessoa(n).id;
  sala.expenses = [...(sala.expenses || []), ...tabela.hashes().map((g, i) => ({ id: 'dooutro' + i, desc: g['o quê'],
    amount: Number(g.valor.replace(/\./g, '').replace(',', '.')), payer: id(g.pagou), among: g['divide entre'].split(/\s*,\s*/).map(id), at: AGORA }))];
});
// a edição do outro aparelho é de um minuto antes da minha (o relógio da página começa em AGORA)
const trocaValor = async ({ mundo }, quem, desc, valor) => {
  const sala = salaNoBanco(mundo), velho = sala.expenses.find(e => e.desc === desc);
  sala.expenses = [...sala.expenses.filter(e => e !== velho), { ...velho, id: 'dooutro', amount: valor, by: quem }];
  sala.deleted = [...(sala.deleted || []), velho.id];
  sala.gone = [...(sala.gone || []), { id: velho.id, desc, amount: velho.amount, at: velho.at, by: quem, goneAt: AGORA - 60000, to: 'dooutro' }];
};
When('a/o {word} troca o valor do/da {string} pra R$ {num} em outro aparelho', trocaValor);
Given('que a/o {word} trocou o valor do/da {string} pra R$ {num} em outro aparelho', trocaValor);
Then('o {string} está marcado como mudou', async ({ mundo }, nome) => { await expect(item(mundo.p, nome).locator('.row .tag')).toHaveText('mudou'); });
Then('o {string} não está marcado', async ({ mundo }, nome) => { await expect(item(mundo.p, nome).locator('.row .tag')).toHaveCount(0); });
Then('o {string} diz {string}', async ({ mundo }, nome, txt) => {
  await expect(item(mundo.p, nome).locator('.small .by')).toHaveText(`· ${txt}`);
});

// quem anotou: o aparelho grava o nome e o id de quem estava nele na hora
Given('que a/o {word} anotou o {string}', async ({ mundo }, quem, nome) => {
  const p = mundo.pessoa(quem), e = mundo.evento.expenses.find(x => x.desc === nome);
  Object.assign(e, { by: p.name, byId: p.id });
});
// o nome muda só na turma: o que já foi anotado continua com o nome velho escrito
Given('que a/o {word} trocou o nome pra {word}', async ({ mundo }, de, pra) => { mundo.pessoa(de).name = pra; });
Given('que entrou na turma outra/outro {word}', async ({ mundo }, nome) => {
  mundo.evento.people.push({ id: idDe(nome) + 'nova', name: nome, at: mundo.evento.people.length + 1 });
});
Then('o {string} diz que foi anotado por {word}', async ({ mundo }, nome, quem) => {
  await expect(item(mundo.p, nome).locator('.small .by')).toHaveText(`· anotado por ${quem}`);
});
Then('eu posso editar e excluir o {string}', async ({ mundo }, nome) => {
  await expect(item(mundo.p, nome).locator('[data-edit-expense]')).toHaveCount(1);
  await expect(item(mundo.p, nome).locator('[data-del-expense]')).toHaveCount(1);
});
Then('eu não posso editar nem excluir o {string}', async ({ mundo }, nome) => {
  await expect(item(mundo.p, nome).locator('[data-edit-expense], [data-del-expense]')).toHaveCount(0);
});

// o outro aparelho grava direto no banco, uns minutos antes: a minha nota ainda não sabe dele
When('a/o {word} anota em outro aparelho um {string} de R$ {num} que a/o {word} pagou, há {int} minutos', async ({ mundo }, quem, desc, valor, pagou, min) => {
  const sala = salaNoBanco(mundo), p = mundo.pessoa(quem);
  sala.expenses = [...(sala.expenses || []), { id: 'dooutro', desc, amount: valor, payer: mundo.pessoa(pagou).id,
    among: sala.people.map(x => x.id), at: AGORA - min * 60000, by: p.name, byId: p.id }];
});
When('eu tento anotar {string} de R$ {num} que eu paguei', async ({ mundo }, desc, valor) => {
  const p = mundo.p; await p.click('#fab'); await p.waitForSelector('#sheet:not(.hidden)');
  await p.fill('#amount', dinheiro(valor)); await p.fill('#desc', desc); await p.click('#expenseForm button.big');
});
Then('o anotar continua aberto com R$ {num} de {string}', async ({ mundo }, v, desc) => {
  await expect(mundo.p.locator('#sheet')).toBeVisible();
  await expect(mundo.p.locator('#amount')).toHaveValue(dinheiro(v)); await expect(mundo.p.locator('#desc')).toHaveValue(desc);
});
When('eu anoto mesmo assim', async ({ mundo }) => { await mundo.p.click('#okBtn'); await mundo.p.waitForSelector('#sheet', { state: 'hidden' }); });

// conta fixa: o gasto que volta todo mês. Divide entre todo mundo; o dia e o mês são os do primeiro
Given('o {string} de R$ {num}, que a/o {word} paga todo mês desde {int}\\/{int}', async ({ mundo }, desc, valor, quem, dia, mes) => {
  const id = 'fixo' + mundo.evento.expenses.length, dd = String(dia).padStart(2, '0'), mm = String(mes).padStart(2, '0');
  mundo.evento.expenses.push({ id, desc, amount: valor, payer: mundo.pessoa(quem).id, among: mundo.evento.people.map(p => p.id),
    at: Date.parse(`2026-${mm}-${dd}T12:00:00-03:00`), rec: id });
});
When('eu anoto {string} de R$ {num} dividido igualmente, todo mês', async ({ mundo }, desc, valor) => {
  const p = mundo.p; await p.click('#fab'); await p.waitForSelector('#sheet:not(.hidden)');
  await p.fill('#amount', dinheiro(valor)); await p.fill('#desc', desc); await p.check('#fixo'); await p.click('#expenseForm button.big');
  await p.waitForSelector('#sheet', { state: 'hidden' });
});
Then('o {string} repete todo mês', async ({ mundo }, nome) => { await expect(item(mundo.p, nome).locator('.small .fixo')).toHaveText(' · todo mês'); });
Then('o {string} aparece {int} vez(es) na lista', async ({ mundo }, nome, n) => { await expect(item(mundo.p, nome)).toHaveCount(n); });
// a lista vem do mais novo pro mais velho: o primeiro com esse nome é o deste mês
When('eu excluo o {string} deste mês', async ({ mundo }, nome) => {
  const it = item(mundo.p, nome).first(); await it.locator('.row .l').click();
  await it.getByRole('button', { name: `excluir o gasto ${nome}` }).click(); await mundo.p.click('#okBtn');
});
