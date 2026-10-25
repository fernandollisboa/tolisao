// npm run contas: as contas de verdade de specs/contas/ lidas pelo leitor de verdade (ocr/), no app de verdade, e
// conferidas com o que cada uma tem (o <nome>.json do lado da foto). Não é teste do CI: o leitor baixa 5 MB e leva
// segundos por foto. Diz, por conta, quantos itens saíram com o valor certo, quantos com o nome parecido, o que veio
// a mais, o serviço, se a soma bateu com o TOTAL lido, e se o "anotar" (todo mundo em tudo) dá o total da conta.
//   npm run contas                      todas
//   npm run contas -- joakins           só as que têm "joakins" no nome
//   npm run contas -- --variacoes       cada uma também escura, tremida, torta e comprimida (como o zap faz)
//   npm run contas -- --grava           guarda o que o leitor leu (cada leitura da foto) em <nome>.lido.json, que o
//                                       foto.feature dá pro app no lugar do leitor
const fs = require('fs'), path = require('path');
const { chromium } = require('./_pw.cjs');
const servir = require('./_serve.cjs');
const { Banco } = require('./_banco.cjs');
const { Api } = require('./_api.cjs');

const PASTA = path.join(__dirname, 'contas');
const args = process.argv.slice(2);
const filtro = args.filter(a => !a.startsWith('--'));
const GRAVA = args.includes('--grava'), VARIACOES = args.includes('--variacoes');
const contas = fs.readdirSync(PASTA).filter(f => /\.(jpe?g|png)$/i.test(f)).map(f => f.replace(/\.\w+$/, ''))
  .filter(n => !filtro.length || filtro.some(f => n.includes(f)));

// a foto mexida no navegador, do jeito que a mesa do bar estraga ela
const VARIA = {
  escura: 'ctx.filter = "brightness(.4) sepia(.6)"; ctx.drawImage(img, 0, 0);',
  tremida: 'ctx.filter = `blur(${Math.max(1, img.width / 700)}px)`; ctx.drawImage(img, 0, 0);',
  torta: 'ctx.fillStyle = "#4a3520"; ctx.fillRect(0, 0, w, h); ctx.translate(w / 2, h / 2); ctx.rotate(6 * Math.PI / 180); ctx.drawImage(img, -img.width / 2, -img.height / 2);',
  zap: 'ctx.drawImage(img, 0, 0, w, h);',
};
const tamanho = { zap: (w, h) => [Math.min(w, 900), Math.round(h * Math.min(1, 900 / w))] };

// o leitor de verdade, com um embrulho que guarda as linhas de cada leitura em window.__lidos (o que o --grava salva)
const embrulho = `\n;(() => { const cria = Tesseract.createWorker; Tesseract.createWorker = async (...a) => { const w = await cria(...a);
  const le = w.recognize.bind(w); w.recognize = async (...b) => { const r = await le(...b);
  const cx = (b) => ({ x0: Math.round(b.x0), y0: Math.round(b.y0), x1: Math.round(b.x1), y1: Math.round(b.y1) });
  (window.__lidos ||= []).push((r.data.blocks || []).flatMap((bl) => bl.paragraphs.flatMap((p) => p.lines)).map((l) => ({ text: l.text.trim(), bbox: cx(l.bbox),
    words: l.words.map((w) => ({ text: w.text, confidence: Math.round(w.confidence), bbox: cx(w.bbox) })) })));
  return r; }; return w; }; })();`;

const so = s => s.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
/** o nome lido é o mesmo do esperado, tirando o que o leitor erra de letra: 70% das letras na mesma ordem */
function parecido(a, b) {
  a = so(a); b = so(b);
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length, 1) >= 0.7;
}

(async () => {
  const banco = new Banco(), api = new Api();
  banco.sala({ name: 'contas', people: [{ id: 'ana', name: 'Ana', at: 1 }, { id: 'beto', name: 'Beto', at: 2 }], deleted: [], expenses: [] });
  const { srv, porta } = await servir({ banco, api });
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  // a CSP do site barra o new Function das variações: aqui é ferramenta, não o site no ar
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true });
  const real = fs.readFileSync(path.join(__dirname, '..', 'ocr', 'tesseract.min.js'), 'utf8');
  await ctx.route('**/ocr/tesseract.min.js', r => r.fulfill({ contentType: 'text/javascript', body: real + embrulho }));
  const p = await ctx.newPage();
  p.on('pageerror', e => console.error('erro na página:', e.message));
  await p.goto(`http://localhost:${porta}/?evento=contas&mesa`);
  await p.locator('#chegada [data-chegou], #overlayBox [data-sou]', { hasText: /^Ana$/ }).first().click();
  await p.click('#fab');

  const linhas = [];
  let somaItens = 0, somaValores = 0, somaNomes = 0, somaMais = 0, somaAnota = 0;
  for (const nome of contas) {
    const esperado = JSON.parse(fs.readFileSync(path.join(PASTA, nome + '.json'), 'utf8'));
    const foto = path.join(PASTA, fs.readdirSync(PASTA).find(f => f.startsWith(nome + '.') && !f.endsWith('.json')));
    for (const v of ['', ...(VARIACOES ? Object.keys(VARIA) : [])]) {
      let arquivo = foto;
      if (v) {
        // a variação sai do navegador, num canvas, e vai pro seletor de arquivo como se fosse outra foto
        const b64 = await p.evaluate(async ({ src, js, tam }) => {
          const img = await createImageBitmap(await (await fetch(src)).blob());
          const [w, h] = tam ? new Function('w', 'h', `return (${tam})(w, h)`)(img.width, img.height) : [img.width, img.height];
          const cv = Object.assign(document.createElement('canvas'), { width: w, height: h }), ctx = cv.getContext('2d');
          new Function('ctx', 'img', 'w', 'h', js)(ctx, img, w, h);
          return cv.toDataURL('image/jpeg', 0.7).split(',')[1];
        }, { src: `/specs/contas/${path.basename(foto)}`, js: VARIA[v], tam: tamanho[v] && String(tamanho[v]) });
        arquivo = { name: `${nome}-${v}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
      }
      const t0 = Date.now();
      await p.evaluate(() => (window.__lidos = []));
      const [escolhe] = await Promise.all([p.waitForEvent('filechooser'), p.click('#fotoBtn')]);
      await escolhe.setFiles(arquivo);
      await p.waitForFunction(() => !/lendo/.test(document.querySelector('#fotoRecado')?.textContent || 'lendo'), null, { timeout: 120000 });
      const achou = await p.$$eval('#fotoItens .it .row', rs => rs.map(r => {
        const l = r.querySelector('.l').textContent, m = l.match(/^([\d,]+)× (.*)$/);
        return { nome: m ? m[2] : l, qtd: m ? +m[1].replace(',', '.') : 1, valor: r.querySelector('.v').textContent };
      }));
      if (GRAVA && !v) fs.writeFileSync(path.join(PASTA, nome + '.lido.json'), JSON.stringify(await p.evaluate(() => window.__lidos)) + '\n');
      // todo mundo pega tudo: o serviço que aparece e o que vai pro anotar são os da conta inteira
      for (let i = 0; i < achou.length; i++) {
        await p.click(`#fotoItens [data-it="${i}"]`);
        await p.click('#fotoItem [data-pegou="*"]');
      }
      const servico = await p.$eval('#fotoItens', e => (e.querySelector('#fotoTaxa')?.checked ? e.querySelector('.taxaFoto .v').textContent : null)).catch(() => null);
      const confere = await p.$eval('#fotoItens', e => e.querySelector('.confere')?.className || '').catch(() => '');
      const anota = (await p.textContent('#fotoUsar')).replace(/[^\d,]/g, '');
      // cada item esperado casa com um achado de mesmo valor; o nome conta à parte
      const sobra = [...achou];
      let valores = 0, nomes = 0;
      for (const it of esperado.itens) {
        const i = sobra.findIndex(a => a.valor === it.valor);
        if (i < 0) continue;
        valores++;
        if (parecido(sobra[i].nome, it.nome)) nomes++;
        sobra.splice(i, 1);
      }
      const n = esperado.itens.length;
      somaItens += n; somaValores += valores; somaNomes += nomes; somaMais += sobra.length; somaAnota += anota === esperado.total ? 1 : 0;
      const serv = esperado.servico === servico ? (servico ? `${servico} ✔` : '— ✔') : `${servico || '—'} ✘ (${esperado.servico || '—'})`;
      linhas.push([nome + (v ? ` (${v})` : ''), `${valores}/${n}`, `${nomes}/${n}`, String(sobra.length), serv,
        /\bok\b/.test(confere) ? 'bate' : /erro/.test(confere) ? 'não bate' : 'não leu', anota === esperado.total ? `${anota} ✔` : `${anota || '—'} ✘ (${esperado.total})`,
        `${((Date.now() - t0) / 1000).toFixed(1)} s`,
        sobra.map(s => `${s.nome} ${s.valor}`).join('; ')]);
      await p.click('#fotoVoltar');
    }
  }
  const cab = ['conta', 'valores', 'nomes', 'a mais', 'serviço', 'TOTAL', 'anota', 'tempo', 'o que veio a mais'];
  const larg = cab.map((c, i) => Math.max(c.length, ...linhas.map(l => l[i].length)));
  for (const l of [cab, ...linhas]) console.log(l.map((c, i) => c.padEnd(larg[i])).join('  ').trimEnd());
  console.log(`\nvalores certos: ${somaValores}/${somaItens} · nomes parecidos: ${somaNomes}/${somaItens} · itens a mais: ${somaMais} · ` +
    `contas que anotam o total certo: ${somaAnota}/${linhas.length}`);
  await b.close(); srv.close();
})();
