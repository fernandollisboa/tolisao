const { Given, When, Then, expect } = require('./_mundo.cjs');

const botao = p => p.locator('#mineRows [data-aviso]');
const pedidos = (mundo, rota) => mundo.api.rota(rota).map(x => x.corpo);

Given('que meu celular aceita aviso', async ({ mundo }) => { mundo.celularComAviso = true; });

Then('Minha conta oferece {string}', async ({ mundo }, txt) => { await expect(botao(mundo.p)).toHaveText(txt); });
Then('Minha conta não oferece aviso no celular', async ({ mundo }) => {
  await expect(mundo.p.locator('#mineRows [data-settle]').first()).toBeVisible();
  await expect(botao(mundo.p)).toHaveCount(0);
});

When('eu ligo o aviso no celular', async ({ mundo }) => { await botao(mundo.p).click(); });
Then('o botão do aviso sai de Minha conta', async ({ mundo }) => { await expect(botao(mundo.p)).toHaveCount(0); });

Then('o celular fica inscrito pra receber o aviso da/do {word}', async ({ mundo }, nome) => {
  await expect.poll(() => pedidos(mundo, '/inscreve').length).toBe(1);
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

// o Safari do iPhone fora da tela de início: sem Notification nem PushManager, que só existem no app instalado
Given('que meu celular é um iPhone sem o tô lisa instalado', async ({ mundo }) => {
  mundo.aparelho.push(() => {
    const w = /** @type {any} */ (window);
    Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1' });
    delete w.Notification; delete w.PushManager;
  });
});
// o navegador do Instagram põe "Instagram" no fim do userAgent; push ele também não tem
Given('que meu celular é um iPhone com o link aberto no Instagram', async ({ mundo }) => {
  mundo.aparelho.push(() => {
    const w = /** @type {any} */ (window);
    Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0 (iPhone15,2; iOS 18_0; pt_BR; pt-BR; scale=3.00; 1179x2556)' });
    delete w.Notification; delete w.PushManager;
  });
});
When('eu copio o link pro Safari', async ({ mundo }) => { await mundo.p.click('#instLink'); });
Then('fica copiado o link do evento que já entra como {word}', async ({ mundo }, quem) => {
  await expect.poll(() => mundo.p.evaluate(() => /** @type {any} */ (window).__copiado))
    .toMatch(new RegExp(`^${mundo.base}/(semverba|sextou|fiado)/\\?evento=${mundo.evento.name}&quem=${mundo.pessoa(quem).id}$`));
});
Then('não aparece o passo a passo do Safari', async ({ mundo }) => {
  await expect(mundo.p.locator('#overlay')).not.toContainText('Adicionar à Tela de Início');
});
// o Chrome do Android avisa a página que dá pra instalar; o convite anota quantas vezes foi aberto
Given('que meu navegador oferece instalar o tô lisa', async ({ mundo }) => {
  mundo.aparelho.push(() => addEventListener('DOMContentLoaded', () => {
    const w = /** @type {any} */ (window);
    w.__convites = 0;
    dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }),
      { prompt: () => { w.__convites++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) }));
  }));
});

Then('aparece o passo a passo de instalar na Tela de Início', async ({ mundo }) => {
  const o = mundo.p.locator('#overlay');
  await expect(o.locator('h2')).toHaveText('Instalar');
  await expect(o).toContainText('aviso só chega com o tô lisa na Tela de Início. Copia o link do evento, instala, cola o link no campo');
  await expect(o).toContainText('Adicionar à Tela de Início');
});
Then('o celular não fica inscrito pra receber aviso', async ({ mundo }) => { expect(pedidos(mundo, '/inscreve')).toHaveLength(0); });
Then('o navegador me convida a instalar o tô lisa', async ({ mundo }) => {
  expect(await mundo.p.evaluate(() => /** @type {any} */ (window).__convites)).toBe(1);
});
