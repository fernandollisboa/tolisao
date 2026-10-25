const path = require('path');
const { Given, When, Then, expect } = require('./_mundo.cjs');

// o leitor de verdade (ocr/) baixa 5 MB e leva segundos por foto: aqui ele é trocado por um que "lê" o que o
// cenário disse, linha por linha, com as palavras separadas por espaço e uma caixa pra cada uma
const leitorFalso = (linhas) => `window.Tesseract = { createWorker: async () => ({ recognize: async () => ({ data: { blocks: [{ paragraphs: [{ lines: ${JSON.stringify(
  linhas.map((t, i) => {
    const y = 120 + i * 50;
    let x = 100;
    const words = t.split(/\s+/).filter(Boolean).map((text) => {
      const w = { text, confidence: 90, bbox: { x0: x, y0: y, x1: x + text.length * 18, y1: y + 36 } };
      x = w.bbox.x1 + 20;
      return w;
    });
    return { text: t, words, bbox: { x0: 100, y0: y, x1: Math.max(x, 101), y1: y + 36 } };
  }))} }] }] } }) }) };`;
// a foto em si não importa pro leitor falso: qualquer imagem serve
const FOTO = path.join(__dirname, '..', '..', 'og', 'inicio.jpg');
const itemDaFoto = (p, nome) => p.locator('#fotoItens .it').filter({ has: p.locator('.row .l', { hasText: new RegExp(`^(\\d+× )?${nome}$`) }) });

Given('uma conta em que se lê:', async ({ mundo }, texto) => { mundo.contaLida = texto.split('\n'); });
Given('uma conta em que não se lê preço nenhum', async ({ mundo }) => { mundo.contaLida = []; });

When('eu fotografo a conta', async ({ mundo }) => {
  const p = mundo.p;
  await p.route('**/ocr/tesseract.min.js', (r) => r.fulfill({ contentType: 'text/javascript', body: leitorFalso(mundo.contaLida || []) }));
  const [escolhe] = await Promise.all([p.waitForEvent('filechooser'), p.click('#fotoBtn')]);
  await escolhe.setFiles(FOTO);
  await expect(p.locator('#fotoRecado')).not.toHaveText('lendo a conta…');
});
When(/^na foto, (.+) (?:pegou|pegaram) (?:o |a )?(.+)$/, async ({ mundo }, quem, nome) => {
  const p = mundo.p;
  await itemDaFoto(p, nome).click();
  if (quem === 'todos') return void (await p.click('#fotoItem [data-pegou="*"]'));
  for (const n of quem.split(/, | e /)) await p.click(`#fotoItem [data-pegou="${mundo.pessoa(n).id}"]`);
});
When(/^eu corrijo o valor d[oa] (.+) pra ([\d.,]+) na foto$/, async ({ mundo }, nome, v) => {
  await itemDaFoto(mundo.p, nome).click();
  await mundo.p.fill('#fotoItem input[data-valor]', v);
});
When('eu anoto o que a foto dividiu', async ({ mundo }) => { await mundo.p.click('#fotoUsar'); });

Then('o anotar não tem a câmera', async ({ mundo }) => { await expect(mundo.p.locator('#fotoBtn')).toBeHidden(); });
Then('o anotar tem a câmera', async ({ mundo }) => { await expect(mundo.p.locator('#fotoBtn')).toBeVisible(); });
Then('a foto acha os itens:', async ({ mundo }, tabela) => {
  const linhas = mundo.p.locator('#fotoItens .it .row');
  await expect(linhas.locator('.l')).toHaveText(tabela.hashes().map((r) => r.item));
  await expect(linhas.locator('.v')).toHaveText(tabela.hashes().map((r) => r.valor));
});
Then('a foto diz {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#overlayBox')).toContainText(txt); });
Then(/^o valor do anotar é ([\d.,]+)$/, async ({ mundo }, v) => { await expect(mundo.p.locator('#amount')).toHaveValue(v); });
