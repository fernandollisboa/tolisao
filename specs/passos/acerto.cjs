const os = require('os'), path = require('path'), fs = require('fs');
const { Given, When, Then, expect, AGORA } = require('./_mundo.cjs');

const num = t => Number(t.replace(/[^\d,]/g, '').replace(',', '.'));
const linhasDoAcerto = p => p.$$eval('#settle .row:not(.paid)', l => l.map(r => {
  const [quem, pra] = r.querySelector('.l').textContent.split('→').map(s => s.trim());
  return { quem, 'paga pra': pra, valor: r.querySelector('.num').textContent.trim() }; }));
const minhaLinha = (p, nome) => p.$$eval('#mineRows .row.sub', (l, nome) => {
  const r = l.find(r => r.querySelector('.nm')?.textContent === nome); return r ? r.querySelector('.num').textContent : null; }, nome);

Then('falta pagar:', async ({ mundo }, tabela) => { await expect.poll(() => linhasDoAcerto(mundo.p)).toEqual(tabela.hashes()); });
Then('a minha linha no acerto é {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#settle .row.mine .l')).toHaveText(txt); });
Then('o Falta pagar não tem botão nenhum', async ({ mundo }) => { await expect(mundo.p.locator('#settle button')).toHaveCount(0); });

Then('Minha conta diz {string} R$ {num}', async ({ mundo }, titulo, valor) => {
  const topo = mundo.p.locator('#mineRows .row:not(.sub)').first();
  await expect(topo.locator('.l')).toHaveText(titulo);
  expect(num(await topo.locator('.num').textContent())).toBe(valor);
});
Then('eu devo R$ {num} pro/pra {word}', async ({ mundo }, valor, nome) => { await expect.poll(async () => num(await minhaLinha(mundo.p, nome) || '')).toBe(valor); });
Then('o/a {word} me deve R$ {num}', async ({ mundo }, nome, valor) => { await expect.poll(async () => num(await minhaLinha(mundo.p, nome) || '')).toBe(valor); });
Then('eu vejo {int} botão/botões de quitar em Minha conta', async ({ mundo }, n) => { await expect(mundo.p.locator('#mineRows [data-settle]')).toHaveCount(n); });

Then('o subtítulo diz {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#tagline')).toHaveText(txt); });
Then('o sincronizado fica no rodapé, depois do código de barras', async ({ mundo }) => {
  await expect(mundo.p.locator('#status')).not.toHaveCSS('display', 'none');
  expect(await mundo.p.evaluate(() => !!(document.querySelector('.bars').compareDocumentPosition(document.querySelector('#status')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
});
Then('a página não fica mais larga que a tela', async ({ mundo }) => {
  expect(await mundo.p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

const quita = async (p, fecha) => { await p.click('#mineRows [data-settle]'); await p.click('#okBtn'); await p.click(fecha); };
When('eu quito a primeira linha de Minha conta', async ({ mundo }) => { await quita(mundo.p, '#quitOk'); });
When('eu quito a primeira linha de Minha conta e aviso no zap', async ({ mundo }) => { await quita(mundo.p, '#waAviso'); });
const pago = (p, txt) => p.locator('#settle .row.paid').filter({ has: p.locator('.n', { hasText: txt }) });
const desfaz = async (p, txt) => { await pago(p, txt).locator('[data-undo]').click({ clickCount: 3 }); await p.waitForSelector('#okBtn'); };
When('eu começo a desfazer o pagamento {string} e volto atrás', async ({ mundo }, txt) => {
  await desfaz(mundo.p, txt); await mundo.p.click('#cancelBtn'); await mundo.p.waitForSelector('#overlay', { state: 'hidden' });
});
When('eu toco duas vezes no carimbo do pagamento {string}', async ({ mundo }, txt) => { await pago(mundo.p, txt).locator('[data-undo]').click({ clickCount: 2 }); await mundo.p.waitForTimeout(650); });
Then('nenhum cartão abre', async ({ mundo }) => { await expect(mundo.p.locator('#overlay')).toBeHidden(); });
When('eu desfaço o pagamento {string}', async ({ mundo }, txt) => { await desfaz(mundo.p, txt); await mundo.p.click('#okBtn'); });
Then('o pagamento {string} está carimbado {string}', async ({ mundo }, txt, selo) => { await expect(pago(mundo.p, txt).locator('.stamp', { hasText: selo })).toHaveCount(1); });
Then('o pagamento {string} está carimbado {string} por {word}', async ({ mundo }, txt, selo, quem) => {
  const l = pago(mundo.p, txt).filter({ has: mundo.p.locator('.stamp', { hasText: selo }) });
  await expect(l.locator('.stamp')).toHaveText(selo);
  await expect(l.locator('xpath=following-sibling::*[1]')).toHaveText(`por ${quem}`);
});
Then('o pagamento {string} continua carimbado', async ({ mundo }, txt) => { await expect(pago(mundo.p, txt).locator('.stamp')).toHaveText('PAGO'); });
Then('nenhum pagamento está carimbado', async ({ mundo }) => { await expect(mundo.p.locator('#settle .row.paid')).toHaveCount(0); });
Then('o zap abre com a mensagem:', async ({ mundo }, txt) => {
  await expect.poll(() => mundo.p.evaluate(() => window.__aberto ? decodeURIComponent(window.__aberto.split('text=')[1]).replace(/\u00a0/g, ' ').trim() : null))
    .toBe(txt.replace('{site}', mundo.base).trim());
  // pelo wa.me n\u00e3o: ele redireciona pra c\u00e1 trocando emoji astral (\ud83e\uddfe \ud83d\udcb8 \ud83d\udc49) por U+FFFD
  expect(await mundo.p.evaluate(() => window.__aberto)).toContain('https://api.whatsapp.com/send?text=');
});

When('eu cobro o/a {word} no zap', async ({ mundo }, nome) => {
  await mundo.p.locator('#mineRows .row.sub').filter({ has: mundo.p.locator('.nm', { hasText: nome }) }).locator('[data-cobra]').click();
});
When('eu toco em copiar pix', async ({ mundo }) => { await mundo.p.click('#mineRows [data-pix]'); });
// as chaves se buscam de novo a cada 30s: o relógio anda até lá com o banco sem responder.
// Depois da falha a nota se redesenha na hora; os 300ms são folga pra esse redesenho
When('a rede engasga quando o app busca as chaves pix de novo', async ({ mundo }) => {
  await mundo.p.locator('#mineRows [data-pix]').waitFor();
  mundo.banco.pixFora = true;
  await mundo.p.context().clock.runFor(30000);
  await expect.poll(() => mundo.banco.pixFalhas || 0).toBeGreaterThan(0);
  await mundo.p.waitForTimeout(300);
});
Then('fica copiado o pix copia e cola:', async ({ mundo }, txt) => { await expect.poll(() => mundo.p.evaluate(() => window.__copiado)).toBe(txt.trim()); });

// enviar pergunta antes pra quem é o link: "qualquer um" é o data-link-pra vazio
const envia = async (mundo, id) => {
  await mundo.p.click('#waBtn');
  const [baixou] = await Promise.all([mundo.p.waitForEvent('download'), mundo.p.click(`[data-link-pra="${id}"]`)]); mundo.nota.download = baixou;
};
When('eu toco em enviar', async ({ mundo }) => { await envia(mundo, ''); });
When('eu toco em enviar pra {word}', async ({ mundo }, quem) => { await envia(mundo, mundo.pessoa(quem).id); });
Then('baixa a imagem {string}', async ({ mundo }, nome) => {
  const d = mundo.nota.download; expect(d.suggestedFilename()).toBe(nome);
  const arq = path.join(os.tmpdir(), 'receipt.png'); await d.saveAs(arq); mundo.nota.comanda = arq;
  expect(fs.readFileSync(arq).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});

// espera o ✔ aparecer: medido ainda escondido, ele tem altura 0 e estilo vazio (NaN)
const area = async p => { await p.locator('#mineRows .dupla > button').first().waitFor({ state: 'visible' }); return p.$eval('#mineRows .dupla > button', b => { const a = getComputedStyle(b, '::after'), h = b.getBoundingClientRect().height;
  return a.content === 'none' ? h : h + parseFloat(a.top) * -2; }); };
Then('os botões da minha linha são {string} e {string}', async ({ mundo }, um, outro) => {
  await mundo.p.waitForSelector('#mineRows [data-pix]', { timeout: 8000 });
  expect(await mundo.p.$$eval('#mineRows .dupla > button', l => l.map(b => b.textContent.trim()))).toEqual(expect.arrayContaining([um, outro]));
});
Then('a área de toque do ✔ tem pelo menos {int}px', async ({ mundo }, n) => { expect(await area(mundo.p)).toBeGreaterThanOrEqual(n); });
Then('a área do ✔ tem menos de {int}px', async ({ mundo }, n) => { expect(await area(mundo.p)).toBeLessThan(n); });

// o outro aparelho grava o pagamento no banco; a volta pra aba faz o sync na hora, sem esperar o poll.
// Pronto quando a gaveta anota o id: o aviso (ou a falta dele) já foi decidido
const pagaNoBanco = async (mundo, pagos, extra = {}) => {
  const sala = mundo.banco.arvore.rooms[mundo.sala], ids = [];
  for (const [quem, pra, valor] of pagos) {
    const id = 'pg' + ids.length + Date.now().toString(36);
    ids.push(id);
    sala.expenses = [...(sala.expenses || []), { id, kind: 'payment', desc: 'Pagamento', amount: valor,
      payer: mundo.pessoa(quem).id, among: [mundo.pessoa(pra).id], at: Date.now(), by: quem, ...extra }];
  }
  await mundo.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => mundo.p.evaluate(([k, ids]) => { const v = JSON.parse(localStorage.getItem(k) || '{}').paysSeen || [];
    return ids.every(i => v.includes(i)); }, [`tolisa:${mundo.sala}`, ids])).toBe(true);
};
// a minha nota fica velha: o pagamento entra no banco e ninguém avisa esta aba
When('o/a {word} paga R$ {num} pro/pra {word} em outro aparelho, antes da minha nota atualizar', async ({ mundo }, quem, valor, pra) => {
  const sala = mundo.banco.arvore.rooms[mundo.sala];
  sala.expenses = [...(sala.expenses || []), { id: 'pgfora', kind: 'payment', desc: 'Pagamento', amount: valor,
    payer: mundo.pessoa(quem).id, among: [mundo.pessoa(pra).id], at: Date.now(), by: quem }];
});
Then('o banco tem {int} pagamento(s) da/do {word} pro/pra {word}', async ({ mundo }, n, quem, pra) => {
  const de = mundo.pessoa(quem).id, para = mundo.pessoa(pra).id;
  await expect.poll(() => (mundo.banco.arvore.rooms[mundo.sala].expenses || [])
    .filter(e => e.kind === 'payment' && e.payer === de && e.among[0] === para).length).toBe(n);
});
When('o/a {word} paga R$ {num} pro/pra {word} em outro aparelho', async ({ mundo }, quem, valor, pra) => { await pagaNoBanco(mundo, [[quem, pra, valor]]); });
When('a Mengla e o Klinsmann pagam o que devem pro Fernando em outro aparelho', async ({ mundo }) => {
  await pagaNoBanco(mundo, [['Mengla', 'Fernando', 174.43], ['Klinsmann', 'Fernando', 73.61]]);
});
// o rodapé ganha a hora só no fim do sync, depois do aviso
When('o app sincroniza', async ({ mundo }) => {
  await mundo.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(mundo.p.locator('#status')).toHaveText(/Sincronizado \d/);
});
Then('não aparece aviso de pagamento', async ({ mundo }) => { await expect(mundo.p.locator('#toast')).not.toContainText('te pag'); });

// quem recebe age na própria linha de Minha conta: perdoar (dívida pequena)
const linhaDe = (p, nome) => p.locator('#mineRows .row.sub').filter({ has: p.locator('.nm', { hasText: nome }) });
When('eu perdoo a/o {word}', async ({ mundo }, nome) => { await linhaDe(mundo.p, nome).locator('[data-perdoa]').click(); await mundo.p.click('#okBtn'); });
Then('só a/o {word} tem perdoar em Minha conta', async ({ mundo }, nome) => {
  await expect.poll(() => mundo.p.$$eval('#mineRows .row.sub:has([data-perdoa]) .nm', l => l.map(n => n.textContent))).toEqual([nome]);
});
When('eu começo a desfazer o perdão {string}', async ({ mundo }, txt) => {
  await pago(mundo.p, txt).locator('[data-undo]', { hasText: 'PERDOADO' }).click({ clickCount: 3 }); await mundo.p.waitForSelector('#okBtn');
});
Then('o cartão pergunta {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#overlayBox h2')).toHaveText(txt); });
Given('que o/a {word} já pagou R$ {num} pro/pra {word}', async ({ mundo }, quem, valor, pra) => {
  mundo.evento.expenses.push({ id: 'pg' + mundo.evento.expenses.length, kind: 'payment', desc: 'Pagamento', amount: valor,
    payer: mundo.pessoa(quem).id, among: [mundo.pessoa(pra).id], at: AGORA - 86400000, by: quem });
});
When('o/a {word} perdoa os R$ {num} da/do {word} em outro aparelho', async ({ mundo }, quem, valor, devedor) => {
  await pagaNoBanco(mundo, [[devedor, quem, valor]], { forgiven: true, by: quem });
});
