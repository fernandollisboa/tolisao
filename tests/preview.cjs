// Gera preview do app com dados falsos. Uso como módulo ou pela linha de comando:
//   node tests/preview.cjs '#settle'                      -> um recorte
//   node tests/preview.cjs '#mine' --quem=Lia --saida=/tmp/x.png
//   node tests/preview.cjs '#settle' --variantes=arq.cjs  -> folha comparativa A/B/C
//   node tests/preview.cjs --recorte=0,0,390,240            -> recorte por coordenadas
// O arquivo de variantes exporta { A: { nome, css, js }, B: {...} }.
const { chromium } = require('./_pw.cjs');
const path = require('path'), fs = require('fs'), os = require('os');
const servir = require('./_serve.cjs');

const HOJE = Date.now();
/** evento de exemplo: gente com nomes de tamanhos diferentes, item dividido, uma quitação */
const DADOS = {
  name: 'bailedamada',
  people: [
    { id: 'fernando', name: 'Fernando' }, { id: 'julia', name: 'Júlia' },
    { id: 'lia', name: 'Lia' }, { id: 'mengla', name: 'Mengla' }, { id: 'klinsmann', name: 'Klinsmann' },
  ],
  expenses: [
    { id: 'i1', desc: 'Airbnb', amount: 510, payer: 'fernando', among: ['fernando','julia','lia','mengla','klinsmann'], at: HOJE - 3*86400000 },
    { id: 'i2', desc: 'Gasolina', amount: 136, payer: 'julia', among: ['julia','lia','mengla','klinsmann'], at: HOJE - 2*86400000 },
    { id: 'i3', desc: 'Janta', amount: 42.84, payer: 'julia', among: ['lia','mengla'], shares: { lia: 1887, mengla: 2397 }, at: HOJE - 86400000 },
    { id: 'pg1', kind: 'payment', desc: 'Pagamento', amount: 30, payer: 'mengla', among: ['fernando'], at: HOJE - 3600000 },
  ],
};

/**
 * @param {{alvo?:string, quem?:string, pix?:boolean, largura?:number, altura?:number,
 *          dados?:any, variantes?:Record<string,{nome?:string,css?:string,js?:string}>, recorte?:{x:number,y:number,width:number,height:number},
 *          saida?:string, porta?:number}} opts
 * @returns {Promise<string>} caminho da imagem
 */
async function preview(opts = {}) {
  const { alvo = null, quem = 'Lia', pix = true, largura = 390, altura = 900,
          dados = DADOS, variantes = null, recorte = null, porta = 4300 + Math.floor(Math.random()*200) } = opts;
  const saida = opts.saida || path.join(os.tmpdir(), 'preview.png');
  const srv = servir(porta);
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: 2 });
    await ctx.route(/fake-db/, r => {
      const u = r.request().url();
      if (u.includes('/pix/')) return r.fulfill({ json: pix && u.includes('/fernando/') ? 'fernando@exemplo.com' : null });
      if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
      r.fulfill({ json: dados });
    });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    await p.goto(`http://localhost:${porta}/#c=${dados.name}`);
    await p.click('#whoBtn'); await p.waitForSelector('#whoSel');
    await p.selectOption('#whoSel', { label: quem });
    await p.waitForTimeout(900);

    const tirar = async destino => recorte ? p.screenshot({ path: destino, clip: recorte })
      : alvo ? p.locator(alvo).screenshot({ path: destino }) : p.screenshot({ path: destino, fullPage: true });

    if (!variantes) { await tirar(saida); }
    else {
      const imgs = [];
      for (const [chave, v] of Object.entries(variantes)) {
        const tag = v.css ? await p.addStyleTag({ content: v.css }) : null;
        if (v.js) await p.evaluate(v.js);
        await p.waitForTimeout(150);
        const arq = path.join(os.tmpdir(), `preview-${chave}.png`);
        await tirar(arq); imgs.push({ chave, nome: v.nome || '', arq });
        if (tag) await tag.evaluate(e => e.remove());
      }
      // folha comparativa em tamanho real (encolher deixa o preview mentiroso)
      const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
      const larg = Math.min(2, imgs.length) * (largura + 24) + 24;
      const m = await b.newPage({ viewport: { width: larg, height: 10 } });
      await m.setContent(`<body style="margin:0;background:#15171a;color:#e8e8e8;font:18px ui-monospace,monospace;padding:20px">
        <div style="display:flex;flex-wrap:wrap;gap:24px">${imgs.map(i => `<div><div style="margin-bottom:8px;color:#9fd">${i.chave}${i.nome ? ' · ' + i.nome : ''}</div><img src="${b64(i.arq)}" style="width:${largura}px;display:block"></div>`).join('')}</div></body>`);
      await m.setViewportSize({ width: larg, height: await m.evaluate(() => document.body.scrollHeight) });
      await m.screenshot({ path: saida, fullPage: true });
    }
    if (erros.length) console.error('ERROS NA PÁGINA:', erros);
    return saida;
  } finally { await b.close(); srv.close(); }
}

module.exports = { preview, DADOS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const alvo = args.find(a => !a.startsWith('--')) || null;
  const op = a => (args.find(x => x.startsWith('--' + a + '=')) || '').split('=')[1];
  const varArq = op('variantes');
  preview({
    alvo, quem: op('quem') || 'Lia', saida: op('saida'),
    largura: +op('largura') || 390,
    recorte: op('recorte') ? (([x,y,width,height]) => ({x,y,width,height}))(op('recorte').split(',').map(Number)) : null,
    variantes: varArq ? require(path.resolve(varArq)) : null,
  }).then(f => console.log(f)).catch(e => { console.error(e); process.exit(1); });
}
