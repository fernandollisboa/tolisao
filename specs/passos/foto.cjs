const path = require('path');
const { Given, When, Then, expect } = require('./_mundo.cjs');

// o leitor de verdade (ocr/) baixa 5 MB e leva segundos por foto: aqui ele é trocado por um que "lê" o que o
// cenário disse. Cada preço vem numa linha, com a descrição à esquerda, como numa conta de bar; ou, com
// `linhas`, cada linha vem palavra por palavra, uma ao lado da outra
const palavra = (text, x, y) => ({ text, confidence: 90, bbox: { x0: x, y0: y, x1: x + 20 * text.length, y1: y + 40 } });
const leitorFalso = (precos, linhas) => `window.Tesseract = { createWorker: async () => ({ setParameters: async () => {}, recognize: async () => ({ data: { blocks: [{ paragraphs: [{ lines: ${JSON.stringify(
  linhas
    ? linhas.map((ws, i) => {
      let x = 100;
      return { words: ws.map((t) => { const w = palavra(t, x, 120 + i * 70); x = w.bbox.x1 + 20; return w; }) };
    })
    : precos.map((v, i) => {
      const y = 120 + i * 70;
      return { words: [
        { text: 'ITEM', confidence: 90, bbox: { x0: 150, y0: y, x1: 300, y1: y + 40 } },
        { text: v, confidence: 90, bbox: { x0: 850, y0: y, x1: 980, y1: y + 40 } },
      ] };
    }))} }] }] } }) }) };`;
// a foto em si não importa pro leitor falso: qualquer imagem serve
const FOTO = path.join(__dirname, '..', '..', 'og', 'inicio.jpg');
const lista = (s) => s.split(/, | e /);

Given(/^uma conta em que se lê (\d.*)$/, async ({ mundo }, s) => { mundo.contaLida = lista(s); });
Given('uma conta em que não se lê preço nenhum', async ({ mundo }) => { mundo.contaLida = []; });
// o nome do item numa linha e, na de baixo, a quantidade, o unitário e o total como o leitor viu
// uma linha só, palavra por palavra como o leitor separa (no espaço)
Given('uma conta com a linha {string}', async ({ mundo }, linha) => { mundo.contaLinhas = [linha.split(' ')]; });
Given('uma conta com o item {string} e a linha {string}', async ({ mundo }, nome, linha) => {
  mundo.contaLinhas = [nome.split(' '), linha.split(' ')];
});

When('eu fotografo a conta', async ({ mundo }) => {
  const p = mundo.p;
  await p.route('**/ocr/tesseract.min.js', (r) => r.fulfill({ contentType: 'text/javascript', body: leitorFalso(mundo.contaLida || [], mundo.contaLinhas) }));
  const [escolhe] = await Promise.all([p.waitForEvent('filechooser'), p.click('#fotoBtn')]);
  await escolhe.setFiles(FOTO);
  await expect(p.locator('#fotoRecado')).not.toHaveText('lendo a conta…');
});
When(/^eu toco em (\d.*) na foto$/, async ({ mundo }, s) => {
  for (const v of lista(s)) await mundo.p.locator(`[data-preco][aria-label="R$\u00a0${v}"]`).first().click();
});
When('eu uso a soma da foto', async ({ mundo }) => { await mundo.p.click('#fotoUsar'); });
When('eu toco no item {string} na foto', async ({ mundo }, nome) => { await mundo.p.locator(`[data-preco][title="${nome}"]`).click(); });

Then('o anotar não tem a câmera', async ({ mundo }) => { await expect(mundo.p.locator('#fotoBtn')).toBeHidden(); });
Then('o anotar tem a câmera', async ({ mundo }) => { await expect(mundo.p.locator('#fotoBtn')).toBeVisible(); });
Then(/^a foto soma R\$ ([\d.,]+)$/, async ({ mundo }, v) => { await expect(mundo.p.locator('#fotoSoma')).toHaveText(`R$\u00a0${v}`); });
Then('a foto diz {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#fotoRecado')).toContainText(txt); });
Then(/^o valor do anotar é ([\d.,]+)$/, async ({ mundo }, v) => { await expect(mundo.p.locator('#amount')).toHaveValue(v); });
