const { Given, When, Then, expect, AGORA } = require('./_mundo.cjs');

// o banco pode ter vários eventos; o mundo passa a falar do que foi nomeado
const usa = (mundo, nome) => { const rooms = mundo.banco.arvore.rooms;
  mundo.sala = Object.keys(rooms).find(id => rooms[id].name === nome); mundo.evento = rooms[mundo.sala]; };
const recarrega = async (mundo, acao) => { await Promise.all([mundo.p.waitForEvent('load'), acao()]); await mundo.p.waitForSelector('#overlayBox h2, #app:not(.loading)'); };
const ev = (mundo, nome) => mundo.p.locator('#overlayBox .ev', { hasText: nome });

When('eu abro o evento {string} como {word}', async ({ mundo }, nome, quem) => { usa(mundo, nome); await mundo.abre({ quem }); });
When('eu entro no evento {string}', async ({ mundo }, nome) => {
  usa(mundo, nome); await recarrega(mundo, () => mundo.p.evaluate(q => { location.search = q; }, '?evento=' + nome));
  await mundo.p.waitForSelector('#app:not(.loading)');
});
When('eu entro no evento {string} como {word}', async ({ mundo }, nome, quem) => {
  usa(mundo, nome); await recarrega(mundo, () => mundo.p.evaluate(q => { location.search = q; }, '?evento=' + nome));
  await mundo.p.waitForSelector('#app:not(.loading)'); await mundo.souEu(quem);
});
When('eu abro o site sem código', async ({ mundo }) => { await recarrega(mundo, () => mundo.p.goto(mundo.base + '/')); await mundo.p.waitForSelector('#gateCode'); });
When('eu digito o código {string} no cartão do evento', async ({ mundo }, codigo) => {
  usa(mundo, codigo); await mundo.p.fill('#gateCode', codigo);
  await recarrega(mundo, () => mundo.p.click('#gateForm button')); await mundo.p.waitForSelector('#app:not(.loading)');
});
When('eu toco no {string} da lista', async ({ mundo }, nome) => {
  usa(mundo, nome); await recarrega(mundo, () => ev(mundo, nome).click()); await mundo.p.waitForSelector('#app:not(.loading)');
});
Then('o saldo do {string} é {word}', async ({ mundo }, nome, cor) => {
  await expect(ev(mundo, nome).locator('.v')).toHaveCSS('color', { verde: 'rgb(21, 112, 58)', vermelho: 'rgb(155, 28, 28)' }[cor]);
});
Then('o código do evento não pega o foco sozinho', async ({ mundo }) => { await expect(mundo.p.locator('#gateCode')).not.toBeFocused(); });
When('eu toco no ✕ do {string}', async ({ mundo }, nome) => { await ev(mundo, nome).locator('[data-esquece]').click(); await mundo.p.waitForSelector('#okBtn'); });
Then('o site pergunta {string} com o botão vermelho', async ({ mundo }, txt) => {
  await expect(mundo.p.locator('#overlayBox h2')).toHaveText(txt);
  await mundo.p.mouse.move(0, 0);   // o botão nasce debaixo do mouse que tocou o ✕, e o hover escurece ele
  await expect(mundo.p.locator('#okBtn')).toHaveCSS('background-color', 'rgb(155, 28, 28)');
});
When('eu confirmo', async ({ mundo }) => { await mundo.p.click('#okBtn'); });
When('eu confirmo, e a página recarrega', async ({ mundo }) => { await recarrega(mundo, () => mundo.p.click('#okBtn')); await mundo.p.waitForSelector('#gateCode'); });
Then('a lista do cartão tem só {string}', async ({ mundo }, nome) => {
  await expect(mundo.p.locator('#overlayBox .ev .l')).toHaveText([nome]);
});
Then('a lista de eventos está vazia', async ({ mundo }) => { await expect(mundo.p.locator('#overlayBox .ev')).toHaveCount(0); });

// a data da lista é a última mudança no evento (updatedAt), não a última vez que alguém abriu
Given('que o {string} mudou pela última vez há {int} dias', async ({ mundo }, nome, dias) => {
  Object.values(mundo.banco.arvore.rooms).find(r => r.name === nome).updatedAt = AGORA - dias * 86400000;
});
Then('a lista de eventos é:', async ({ mundo }, tabela) => {
  // a data do banco chega depois do cartão abrir: espera a lista redesenhar
  await expect.poll(() => mundo.p.$$eval('#overlayBox .ev', evs => evs.map(e => [e.querySelector('.l').textContent.trim(), e.querySelector('.sub span:last-child').textContent.trim()])))
    .toEqual(tabela.raw());
});
Given('alguém mexe no {string} ontem, em outro aparelho', async ({ mundo }, nome) => {
  Object.values(mundo.banco.arvore.rooms).find(r => r.name === nome).updatedAt = AGORA - 86400000;
});
