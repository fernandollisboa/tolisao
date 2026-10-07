const { Given, When, Then, expect } = require('./_mundo.cjs');

const botao = p => p.locator('#mineRows [data-aviso]');
const pedidos = (mundo, rota) => mundo.api.rota(rota).map(x => x.corpo);

Given('que meu celular aceita aviso', async ({ mundo }) => { mundo.celularComAviso = true; });

Then('Minha conta oferece {string}', async ({ mundo }, txt) => { await expect(botao(mundo.p)).toHaveText(txt); });
Then('Minha conta não oferece aviso no celular', async ({ mundo }) => {
  await expect(mundo.p.locator('#mineRows [data-settle]').first()).toBeVisible();
  await expect(botao(mundo.p)).toHaveCount(0);
});

When('eu ligo o aviso no celular', async ({ mundo }) => { await botao(mundo.p).click(); await expect.poll(() => pedidos(mundo, '/inscreve').length).toBe(1); });
Then('o botão do aviso sai de Minha conta', async ({ mundo }) => { await expect(botao(mundo.p)).toHaveCount(0); });

Then('o celular fica inscrito pra receber o aviso da/do {word}', async ({ mundo }, nome) => {
  const [i] = pedidos(mundo, '/inscreve');
  expect(i).toMatchObject({ sala: mundo.sala, pessoa: mundo.pessoa(nome).id, sub: { endpoint: expect.any(String) } });
  expect(i.tok).toMatch(/^[a-z0-9]{16,64}$/);
});

Then('o/a {word} é avisado/avisada no celular do pagamento da/do {word}', async ({ mundo }, quem, pagou) => {
  await expect.poll(() => pedidos(mundo, '/avisa').length).toBe(1);
  const [{ sala, id }] = pedidos(mundo, '/avisa');
  expect(sala).toBe(mundo.sala);
  const pago = mundo.banco.arvore.rooms[mundo.sala].expenses.find(e => e.id === id);
  expect(pago).toMatchObject({ kind: 'payment', payer: mundo.pessoa(pagou).id, among: [mundo.pessoa(quem).id] });
});
