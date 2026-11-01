const { When, Then, expect } = require('./_mundo.cjs');

const lista = (s) => s.split(/, | e /);
// a linha da conta com esse valor (a última coluna dela)
const linha = (p, v) => p.locator('[data-preco]', { has: p.locator('.v', { hasText: new RegExp(`^${v.replace('.', '\\.')}$`) }) });

When('eu abro o texto da conta', async ({ mundo }) => { await mundo.p.click('#contaBtn'); await mundo.p.waitForSelector('#contaTexto'); });
// colar é o que o celular faz: o texto entra inteiro na caixa
When('eu colo a conta:', async ({ mundo }, texto) => {
  if (!(await mundo.p.locator('#contaTexto').count())) { await mundo.p.click('#contaBtn'); await mundo.p.waitForSelector('#contaTexto'); }
  await mundo.p.fill('#contaTexto', texto);
});
When(/^eu toco em (\d.*) na conta$/, async ({ mundo }, s) => { for (const v of lista(s)) await linha(mundo.p, v).first().click(); });
When('eu uso a soma da conta', async ({ mundo }) => { await mundo.p.click('#fotoUsar'); });

Then('o anotar não oferece colar a conta', async ({ mundo }) => { await expect(mundo.p.locator('#contaBtn')).toBeHidden(); });
Then('o anotar oferece colar a conta', async ({ mundo }) => { await expect(mundo.p.locator('#contaBtn')).toBeVisible(); });
Then('o cartão ensina a copiar no iPhone e no Android', async ({ mundo }) => {
  const como = mundo.p.locator('.comoCopiar');
  await expect(como).toHaveAttribute('open', ''); await expect(como).toContainText('iPhone'); await expect(como).toContainText('Android');
});
Then(/^a conta soma R\$ ([\d.,]+)$/, async ({ mundo }, v) => { await expect(mundo.p.locator('#fotoSoma')).toHaveText(`R$ ${v}`); });
Then('a conta mostra {string} por {word}', async ({ mundo }, nome, v) => { await expect(linha(mundo.p, v).locator('.l')).toContainText(nome); });
Then('a conta diz {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#contaRecado')).toContainText(txt); });
Then(/^o valor do anotar é ([\d.,]+)$/, async ({ mundo }, v) => { await expect(mundo.p.locator('#amount')).toHaveValue(v); });
