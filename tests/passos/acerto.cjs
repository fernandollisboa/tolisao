const os = require('os'), path = require('path'), fs = require('fs');
const { When, Then, expect } = require('./_mundo.cjs');

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
Then('o zap abre com a mensagem:', async ({ mundo }, txt) => {
  await expect.poll(() => mundo.p.evaluate(() => window.__aberto ? decodeURIComponent(window.__aberto.split('text=')[1]).replace(/\u00a0/g, ' ').trim() : null))
    .toBe(txt.replace('{link do evento}', mundo.link).trim());
});

When('eu toco em copiar pix', async ({ mundo }) => { await mundo.p.click('#mineRows [data-pix]'); });
Then('fica copiado o pix copia e cola:', async ({ mundo }, txt) => { await expect.poll(() => mundo.p.evaluate(() => window.__copiado)).toBe(txt.trim()); });

When('eu toco em enviar', async ({ mundo }) => {
  const [baixou] = await Promise.all([mundo.p.waitForEvent('download'), mundo.p.click('#waBtn')]); mundo.nota.download = baixou;
});
Then('baixa a imagem {string}', async ({ mundo }, nome) => {
  const d = mundo.nota.download; expect(d.suggestedFilename()).toBe(nome);
  const arq = path.join(os.tmpdir(), 'receipt.png'); await d.saveAs(arq);
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
