const { Given, When, Then, expect, idDe } = require('./_mundo.cjs');

const centavos = v => Math.round(Number(v.replace(/\./g, '').replace(',', '.')) * 100);

Given('o evento {string} com {gente}', async ({ mundo }, nome, gente) => {
  mundo.criaEvento({ name: nome, people: gente.map((n, i) => ({ id: idDe(n), name: n, at: i + 1 })), expenses: [], deleted: [] });
});

Given('os gastos:', async ({ mundo }, tabela) => {
  const id = n => mundo.pessoa(n).id;
  tabela.hashes().forEach((g, i) => {
    const e = { id: 'g' + (mundo.evento.expenses.length + 1), desc: g['o quê'], amount: centavos(g.valor) / 100,
      payer: id(g.pagou), among: g['divide entre'].split(/\s*,\s*/).map(id), at: Date.now() - 7 * 86400000 + i * 60000 };
    mundo.evento.expenses.push(e);
  });
});

Given('(que )o/a {word} tem a chave pix {string}', async ({ mundo }, quem, chave) => { mundo.banco.pix(mundo.sala, mundo.pessoa(quem).id, chave); });
Given('(que )o/a {word} já cadastrou a chave pix {string} em outro aparelho', async ({ mundo }, quem, chave) => { mundo.banco.pix(mundo.sala, mundo.pessoa(quem).id, chave); });

Given('que eu abro o site sem evento', async ({ mundo }) => { await mundo.abre({ semEvento: true }); });
When('eu abro o evento como {word}', async ({ mundo }, quem) => { await mundo.abre({ quem }); });
When('eu abro o evento como {word} num celular', async ({ mundo }, quem) => { await mundo.abre({ quem, toque: true }); });
When('eu troco pra {word}', async ({ mundo }, quem) => { await mundo.souEu(quem); });
When('eu abro o evento como {word} em outro aparelho', async ({ mundo }, quem) => { await mundo.abre({ quem }); });
When('eu recarrego a página', async ({ mundo }) => { await mundo.p.reload(); await mundo.p.waitForSelector('#app:not(.loading)'); });

When('eu digito o código {string}', async ({ mundo }, codigo) => { await mundo.p.fill('#gateCode', codigo); await mundo.p.click('#gateForm button'); });
Then('o site pergunta se é um evento novo', async ({ mundo }) => { await expect(mundo.p.locator('#okBtn')).toBeVisible(); });
When('eu volto', async ({ mundo }) => { await mundo.p.click('#cancelBtn'); });
Then('o cartão do código volta com {string} escrito', async ({ mundo }, codigo) => { await expect(mundo.p.locator('#gateCode')).toHaveValue(codigo); });
Then('aparece o recado {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#gateErr')).toHaveText(txt); });
When('eu toco fora do cartão', async ({ mundo }) => { await mundo.p.mouse.click(5, 5); await mundo.p.waitForTimeout(200); });
When('eu crio o evento', async ({ mundo }) => { await mundo.p.click('#okBtn'); await mundo.p.waitForSelector('#app:not(.loading)'); });
Then('o endereço termina em {string}', async ({ mundo }, fim) => { await expect.poll(() => mundo.p.evaluate(() => location.search)).toBe(fim); });
Then('o site não pergunta nada', async ({ mundo }) => { await expect(mundo.p.locator('#okBtn')).toBeHidden(); });
When('eu colo o link {string} na mesma aba', async ({ mundo }, q) => { await mundo.p.evaluate(q => { location.search = q; }, q); });

When('eu toco no nome do evento', async ({ mundo }) => { await mundo.p.click('#roomLabel'); await mundo.p.waitForSelector('#evLeave'); });
Then('o cartão mostra:', async ({ mundo }, txt) => {
  await expect.poll(() => mundo.linhas('#overlayBox')).toEqual(txt.split('\n').map(l => l.trim()).filter(Boolean));
});
Then('o botão de sair do evento é vermelho', async ({ mundo }) => { await expect(mundo.p.locator('#evLeave')).toHaveCSS('color', 'rgb(155, 28, 28)'); });
When('eu toco em voltar', async ({ mundo }) => { await mundo.p.click('#evBack'); });
Then('o cartão fecha', async ({ mundo }) => { await expect(mundo.p.locator('#overlay')).toHaveClass(/\bhidden\b/); });
When('eu toco na caixa do caderno em branco', async ({ mundo }) => { await mundo.p.click('#settle .empty.anota'); });
Then('o formulário de anotar abre', async ({ mundo }) => { await expect(mundo.p.locator('#sheet')).not.toHaveClass(/\bhidden\b/); });
When('eu toco no meu nome', async ({ mundo }) => { await mundo.p.click('#whoBtn'); await mundo.p.waitForSelector('#whoSel'); });
Then('o cartão de quem é você não tem botão de sair', async ({ mundo }) => { await expect(mundo.p.locator('#leaveBtn')).toHaveCount(0); });

When('eu adiciono {string} pela lista de gente do rodapé', async ({ mundo }, nome) => {
  const p = mundo.p;
  await expect(async () => {
    if (await p.locator('#askInput').isVisible()) return;
    await p.evaluate(() => document.getElementById('peopleSec').classList.remove('hidden'));
    await p.click('#addPerson', { timeout: 1000 }); await expect(p.locator('#askInput')).toBeVisible({ timeout: 1000 });
  }).toPass();
  await p.fill('#askInput', nome); await p.click('#askForm button.big');
});
Then('a lista de gente fica {string}', async ({ mundo }, txt) => { await expect.poll(() => mundo.p.$eval('#peopleLine', e => e.innerText)).toBe(txt); });
Then('aparece o aviso {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#toast')).toHaveText(txt); });
