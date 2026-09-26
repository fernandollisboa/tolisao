const { When, Then, expect } = require('./_mundo.cjs');

const dinheiro = v => String(v).replace('.', ',');
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
  await mundo.p.click('#modeToggle'); await mundo.p.waitForSelector('#sharesBox:not(.hidden)');
});
When('eu ponho R$ {num} pra {word}', async ({ mundo }, v, n) => { await mundo.p.fill(`#sharesBox input[data-share="${mundo.pessoa(n).id}"]`, dinheiro(v)); });
When('eu ponho R$ {num} pra {word} e R$ {num} pra {word}', async ({ mundo }, v1, n1, v2, n2) => {
  for (const [v, n] of [[v1, n1], [v2, n2]]) await mundo.p.fill(`#sharesBox input[data-share="${mundo.pessoa(n).id}"]`, dinheiro(v));
});
Then('a frase da divisão diz {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#splitHint')).toHaveText(txt); });
When('eu salvo', async ({ mundo }) => { await mundo.p.click('#expenseForm button.big'); });
Then('embaixo dele está escrito {string}', async ({ mundo }, txt) => {
  await mundo.p.mouse.move(0, 0);
  await expect.poll(() => mundo.p.locator('#expenses .item').first().locator('.small > span').evaluate(e => e.innerText.replace(/\u00a0/g, ' ').trim())).toBe(txt);
});
Then('a lista fica separada em {int} dias', async ({ mundo }, n) => { await expect(mundo.p.locator('#expenses .day')).toHaveCount(n); });
