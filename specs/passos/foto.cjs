const fs = require('fs');
const path = require('path');
const { Given, When, Then, expect } = require('./_mundo.cjs');

// o leitor de verdade (ocr/) baixa 5 MB e leva segundos por foto: aqui ele é trocado por um que "lê" o que o cenário
// disse, linha por linha, com uma caixa pra cada palavra; ou, na conta de verdade, o que o leitor leu dela (uma
// leitura por vez: a foto pequena é lida duas)
const linhasDe = (texto) => texto.map((t, i) => {
  const y = 120 + i * 50;
  let x = 100;
  const words = t.split(/\s+/).filter(Boolean).map((text) => {
    const w = { text, confidence: 90, bbox: { x0: x, y0: y, x1: x + text.length * 18, y1: y + 36 } };
    x = w.bbox.x1 + 20;
    return w;
  });
  return { text: t, words, bbox: { x0: 100, y0: y, x1: Math.max(x, 101), y1: y + 36 } };
});
const leitorFalso = (leituras) => `(() => { const L = ${JSON.stringify(leituras)}; let i = 0;
  window.Tesseract = { createWorker: async () => ({ setParameters: async () => {},
    recognize: async () => ({ data: { blocks: [{ paragraphs: [{ lines: L[Math.min(i++, L.length - 1)] }] }] } }) }) }; })();`;
// a foto em si não importa pro leitor falso: qualquer imagem serve. A da conta de verdade é a dela, que o tamanho
// decide quantas vezes ela é lida
const FOTO = path.join(__dirname, '..', '..', 'og', 'inicio.jpg');
const CONTAS = path.join(__dirname, '..', 'contas');
const itemDaFoto = (p, nome) =>
  p.locator('#fotoItens .it').filter({ has: p.locator('.row .l', { hasText: new RegExp(`^([\\d,]+× )?${nome}$`) }) });

Given('que eu estou no anotar, como {word}', async ({ mundo }, quem) => {
  await mundo.abre({ quem });
  await mundo.p.click('#fab');
  await mundo.p.waitForSelector('#sheet:not(.hidden)');
});
Given('uma conta em que se lê:', async ({ mundo }, texto) => { mundo.leituras = [linhasDe(texto.split('\n'))]; });
Given('uma conta em que não se lê preço nenhum', async ({ mundo }) => { mundo.leituras = [[]]; });
Given('a foto da conta {string}, como o leitor leu', async ({ mundo }, nome) => {
  mundo.leituras = JSON.parse(fs.readFileSync(path.join(CONTAS, nome + '.lido.json'), 'utf8'));
  mundo.foto = path.join(CONTAS, nome + '.jpg');
});

When('eu fotografo a conta', async ({ mundo }) => {
  const p = mundo.p;
  await p.route('**/ocr/tesseract.min.js', (r) => r.fulfill({ contentType: 'text/javascript', body: leitorFalso(mundo.leituras || [[]]) }));
  const [escolhe] = await Promise.all([p.waitForEvent('filechooser'), p.click('#fotoBtn')]);
  await escolhe.setFiles(mundo.foto || FOTO);
  await expect(p.locator('#fotoRecado')).not.toHaveText('lendo a conta…');
});
When(/^na foto, (.+) (?:pegou|pegaram) (?:o |a )?(.+)$/, async ({ mundo }, quem, nome) => {
  const p = mundo.p;
  const marca = async () => {
    if (quem === 'todos') return void (await p.click('#fotoItem [data-pegou="*"]'));
    for (const n of quem.split(/, | e /)) await p.click(`#fotoItem [data-pegou="${mundo.pessoa(n).id}"]`);
  };
  if (nome !== 'tudo') {
    await itemDaFoto(p, nome).click();
    return marca();
  }
  const n = await p.locator('#fotoItens .it').count();
  for (let i = 0; i < n; i++) {
    await p.locator('#fotoItens .it').nth(i).click();
    await marca();
  }
});
// a máscara do valor é a de app de banco: o dígito entra pelo fim. Digita tecla por tecla, como no celular
When(/^eu corrijo o valor d[oa] (.+) pra ([\d.,]+) na foto$/, async ({ mundo }, nome, v) => {
  await itemDaFoto(mundo.p, nome).click();
  await mundo.p.click('#fotoItem input[data-valor]');
  await mundo.p.keyboard.type(v.replace(/\D/g, ''));
});
When(/^eu tiro (?:o |a )?(.+) da foto$/, async ({ mundo }, nome) => {
  await itemDaFoto(mundo.p, nome).click();
  await mundo.p.click('#fotoTira');
});
When(/^eu ponho à mão um item de ([\d.,]+) que faltou na foto$/, async ({ mundo }, v) => {
  await mundo.p.click('#fotoMaisItem');
  await mundo.p.keyboard.type(v.replace(/\D/g, ''));
});
When('eu desligo os 10% da foto', async ({ mundo }) => { await mundo.p.uncheck('#fotoTaxa'); });
When('eu leio a foto de novo, com mais contraste', async ({ mundo }) => {
  await mundo.p.click('#fotoContraste');
  await expect(mundo.p.locator('#fotoContraste')).toHaveText('ler sem contraste');
});
When('eu uso o que a foto dividiu', async ({ mundo }) => { await mundo.p.click('#fotoUsar'); });

Then('o anotar não tem a câmera', async ({ mundo }) => { await expect(mundo.p.locator('#fotoBtn')).toBeHidden(); });
Then('o anotar tem a câmera', async ({ mundo }) => { await expect(mundo.p.locator('#fotoBtn')).toBeVisible(); });
Then('a foto acha os itens:', async ({ mundo }, tabela) => {
  const linhas = mundo.p.locator('#fotoItens .it .row');
  await expect(linhas.locator('.l')).toHaveText(tabela.hashes().map((r) => r.item));
  await expect(linhas.locator('.v')).toHaveText(tabela.hashes().map((r) => r.valor));
});
// os valores, não os nomes: o leitor erra letra (HOSCOW MULE), e o npm run contas é quem conta os nomes
Then('a foto acha os valores da conta {string}', async ({ mundo }, nome) => {
  const { itens } = JSON.parse(fs.readFileSync(path.join(CONTAS, nome + '.json'), 'utf8'));
  const achou = await mundo.p.locator('#fotoItens .it .row .v').allTextContents();
  expect(achou.sort()).toEqual(itens.map((it) => it.valor).sort());
});
Then(/^a foto dá R\$ ([\d.,]+)$/, async ({ mundo }, v) => { await expect(mundo.p.locator('#fotoUsar')).toHaveText(`usar R$ ${v}`); });
Then(/^na foto, (?:o |a )?(.+) continua com (.+)$/, async ({ mundo }, nome, quem) => {
  await expect(itemDaFoto(mundo.p, nome).locator('.quem')).toHaveText(quem);
});
Then('a foto diz {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#overlayBox')).toContainText(txt.replace(/R\$ /g, 'R$\u00a0')); });
Then(/^o valor do anotar é ([\d.,]+)$/, async ({ mundo }, v) => { await expect(mundo.p.locator('#amount')).toHaveValue(v); });
