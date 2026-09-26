const { When, Then, expect } = require('./_mundo.cjs');

const dinheiro = v => v.toFixed(2).replace('.', ',');
const moldura = p => p.$eval('#itemsHead', e => getComputedStyle(e, '::before').display);
const item = (p, nome) => p.locator('#expenses .item').filter({ has: p.locator('.row .l', { hasText: new RegExp(`^${nome.replace(/[()]/g, '\\$&')}$`) }) });

Then('a lista tem {int} itens', async ({ mundo }, n) => { await expect(mundo.p.locator('#expenses .item')).toHaveCount(n); });
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
When('eu anoto {string} de R$ {num} dividido igualmente', async ({ mundo }, desc, valor) => {
  const p = mundo.p; await p.click('#fab'); await p.waitForSelector('#sheet:not(.hidden)');
  await p.fill('#amount', dinheiro(valor)); await p.fill('#desc', desc); await p.click('#expenseForm button.big');
  await p.waitForSelector('#sheet', { state: 'hidden' });
});
Then('o formulário pede primeiro o valor e depois o quê', async ({ mundo }) => {
  expect(await mundo.p.$eval('.two', e => [...e.children].map(c => c.id))).toEqual(['amount', 'desc']);
});
When('eu preencho R$ {num} de {string}', async ({ mundo }, valor, desc) => { await mundo.p.fill('#amount', dinheiro(valor)); await mundo.p.fill('#desc', desc); });
When('eu divido só entre {gente}, em partes diferentes', async ({ mundo }, gente) => {
  const quero = new Set(gente.map(n => mundo.pessoa(n).id));
  for (const chip of await mundo.p.locator('#splitChips input').all()) if ((await chip.isChecked()) !== quero.has(await chip.inputValue())) await chip.locator('xpath=..').click();
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

When('eu toco no "igualmente" da frase', async ({ mundo }) => { await mundo.p.click('#modeToggle'); });
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
