// O png da comanda sai do canvas de verdade, e o texto do zap fecha a conta.
const { abre } = require('./_app.cjs');
const path = require('path'), os = require('os'), fs = require('fs');

(async () => {
  const app = await abre({ semente: true, quem: 'Lia', baixar: true,
    pix: { fernando: 'fernando@exemplo.com' } });
  const p = app.p; const erros = app.erros;
  const exige = (ok, msg) => { if (!ok) erros.push(msg); };
  try {
    p.on('dialog', d => d.accept());
    // uma quitação pra sair o carimbo na comanda
    await p.click('#mineRows [data-settle]'); await p.waitForSelector('#okBtn'); await p.click('#okBtn');
    await p.waitForSelector('#quitOk'); await p.click('#quitOk'); await p.waitForTimeout(200);
    await p.evaluate(() => { window.open = u => { window.__wa = u; }; });

    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#waBtn')]);
    const arq = path.join(os.tmpdir(), 'receipt.png'); await dl.saveAs(arq);
    const png = fs.readFileSync(arq);
    exige(/^evento-.+\.png$/.test(dl.suggestedFilename()), `nome do arquivo estranho: ${dl.suggestedFilename()}`);
    exige(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'o arquivo baixado não é um png');
    exige(png.length > 20000, `o png saiu pequeno demais pra ter a comanda dentro (${png.length} bytes)`);
    const [larg, alt] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    exige(larg > 300 && alt > larg, `a comanda não tem cara de papel em pé (${larg}x${alt})`);
    console.log('comanda:', dl.suggestedFilename(), `| png ${larg}x${alt}, ${(png.length / 1024).toFixed(0)} KB`);

    const texto = decodeURIComponent((await p.evaluate(() => window.__wa)).split('text=')[1] || '');
    console.log('texto:', texto.replace(/\n/g, ' | '));
    exige(texto.includes('bailedamada'), 'o texto do zap não diz de que evento é');
    exige(/#c=bailedamada/.test(texto), 'o texto do zap não leva o link do evento');
    // quem tem chave de pix aparece com ela; o acerto vem em linhas de quem paga quem
    const linhas = texto.split('\n').filter(l => l.includes('paga'));
    exige(linhas.length > 0, 'o texto do zap não traz ninguém pagando ninguém');
    exige(linhas.every(l => /R\$ [\d.]+,\d{2}/.test(l)), `linha de acerto sem valor formatado: ${linhas.join(' | ')}`);
    exige(texto.includes('fernando@exemplo.com'), 'a chave de pix de quem tem não entrou no texto');
    console.log('o zap fecha a conta:', erros.length ? 'FALHOU' : 'ok', '| errors:', erros);
  } finally { await app.fecha(); }
  if (erros.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
