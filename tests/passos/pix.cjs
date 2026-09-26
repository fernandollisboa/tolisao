const { Given, When, Then, expect, idDe } = require('./_mundo.cjs');

When('eu cadastro a chave pix {string}', async ({ mundo }, chave) => {
  const p = mundo.p; await p.click('#pixBtn'); await p.fill('#askInput', chave); await p.click('#askForm button.big');
});
When('eu troco a chave por {string}', async ({ mundo }, chave) => { await mundo.p.fill('#askInput', chave); await mundo.p.click('#askForm button.big'); });
Then('o cartão barra a chave em vermelho', async ({ mundo }) => {
  const p = mundo.p; await expect(p.locator('#overlay')).not.toHaveClass(/\bhidden\b/);
  await expect(p.locator('#askInput')).toHaveClass(/\berro\b/); await expect(p.locator('#askDesc')).toHaveClass(/\berro\b/);
});
When('eu volto a digitar', async ({ mundo }) => { await mundo.p.type('#askInput', 'x'); });
Then('o vermelho sai', async ({ mundo }) => { await expect(mundo.p.locator('#askInput')).not.toHaveClass(/\berro\b/); });
Then('o banco guarda a chave do/da {word} {string}', async ({ mundo }, nome, chave) => {
  await expect.poll(() => mundo.banco.pega(['pix', mundo.sala, mundo.pessoa(nome).id, 'key'])).toBe(chave);
});
Then('o cabeçalho diz {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#whoLine')).toHaveText(new RegExp(`^\\s*${txt}\\s*$`, 'i')); });
Then('não aparece o botão de cadastrar pix', async ({ mundo }) => { await expect(mundo.p.locator('#pixBtn')).toHaveCount(0); });
Then('o cartão de quem é você não tem campo de pix', async ({ mundo }) => {
  await mundo.p.click('#whoBtn'); await mundo.p.waitForSelector('#whoSel');
  await expect(mundo.p.locator('#whoPix')).toHaveCount(0); await mundo.fechaCartao();
});
When('eu tento gravar a chave do/da {word} {string} direto no banco', async ({ mundo }, nome, chave) => {
  mundo.nota.status = await mundo.p.evaluate(async ([url, chave]) => (await fetch(url, { method: 'PUT', body: JSON.stringify({ key: chave, tok: 'tok-deste-aparelho' }) })).status,
    [`https://fake-db.firebaseio.com/pix/${mundo.sala}/${mundo.pessoa(nome).id}.json`, chave]);
});
Then('o banco recusa', async ({ mundo }) => { expect(mundo.nota.status).toBe(401); });

Given('que alguém gravou no banco o evento:', async ({ mundo }, json) => { mundo.criaEvento(JSON.parse(json)); mundo.banco.congelado = true; });
Given('a chave pix da/do {word} é {string}', async ({ mundo }, nome, chave) => { mundo.banco.pix(mundo.sala, idDe(nome), chave); });
When('a lista de gente do rodapé aparece', async ({ mundo }) => { await mundo.p.evaluate(() => document.getElementById('peopleSec').classList.remove('hidden')); });
Then('nenhum script rodou', async ({ mundo }) => { await mundo.p.waitForTimeout(800); expect(await mundo.p.evaluate(() => window.__xss)).toBeUndefined(); });
Then('a lista de gente tem {int} pessoas', async ({ mundo }, n) => { await expect(mundo.p.locator('#peopleLine .nm')).toHaveCount(n); });
Then('a lista tem {int} item, com o {string} escrito como texto', async ({ mundo }, n, txt) => {
  await expect(mundo.p.locator('#expenses .item')).toHaveCount(n); await expect(mundo.p.locator('#expenses .item .l').first()).toContainText(txt);
});
Then('não aparece nenhum botão de copiar pix', async ({ mundo }) => { await expect(mundo.p.locator('[data-pix]')).toHaveCount(0); });
Then('não aparece nenhuma imagem além da ficha', async ({ mundo }) => { await expect(mundo.p.locator('img:not(.stain)')).toHaveCount(0); });
