// ocr: passa cada foto de conta de verdade (specs/contas/) pelo leitor do app, o mesmo do 📷 do anotar, e confere com
// o gabarito dela. Ferramenta, não teste: o leitor baixa 5 MB e leva segundos por foto, então não roda no CI. Serve
// pra saber se uma mudança no leitor melhorou ou piorou, nas contas que a gente já fotografou.
//   npm run ocr                   todas as contas, lidas em cinza e com mais contraste
//   npm run ocr -- xmenu          só as contas com "xmenu" no nome
//   npm run ocr -- --detalhe      lista, conta por conta, o que ele achou e o que faltou
//   npm run ocr -- --texto        e o texto que o leitor leu, linha a linha (pra entender por que não achou)
// O que conta: "itens" é quantos totais de item ele achou (o preço que dá pra tocar, fora os unitários apagados);
// "nome" é quantos desses vieram com o nome certo; "total" é se ele achou o total da conta; "inventou" é preço que
// não está em lugar nenhum da conta (nem item, nem unitário, nem serviço, subtotal ou valor por pessoa).
const { chromium } = require('./_pw.cjs');
const path = require('path'), fs = require('fs');
const servir = require('./_serve.cjs');
const { DADOS } = require('./preview.cjs');

const PASTA = path.join(__dirname, 'contas');
const args = process.argv.slice(2), texto = args.includes('--texto'), detalhe = texto || args.includes('--detalhe'), filtro = args.find(a => !a.startsWith('--'));
const contas = fs.readdirSync(PASTA).filter(f => f.endsWith('.json') && (!filtro || f.includes(filtro))).sort()
  .map(f => ({ nome: f.replace(/\.json$/, ''), foto: path.join(PASTA, f.replace(/\.json$/, '.jpg')),
    ...JSON.parse(fs.readFileSync(path.join(PASTA, f), 'utf8')) }));
if (!contas.length) { console.error(`nenhuma conta${filtro ? ` com "${filtro}"` : ''} em specs/contas/`); process.exit(1); }

const reais = c => (c / 100).toFixed(2).replace('.', ',');
// o nome como a conta escreve, sem acento, caixa e pontuação: o leitor troca Ç por C e às vezes pula a barra
const so = s => String(s).normalize('NFD').replace(/[^a-z0-9]/gi, '').toUpperCase();

/** o que o cartão da foto mostra: cada preço tocável, o unitário apagado, o nome do item e quanto ele levou */
const lido = p => p.evaluate(() => ({
  texto: /** @type {any} */ (window).__lido || '',
  tempo: document.querySelector('#fotoTempo').textContent,
  recado: document.querySelector('#fotoRecado').textContent,
  precos: [...document.querySelectorAll('[data-preco]')].map(b => ({
    c: +b.getAttribute('aria-label').replace(/\D/g, ''), un: b.classList.contains('un'), item: b.getAttribute('title') })),
}));

/** confere o que ele leu com o gabarito */
function nota(conta, { precos }) {
  const tocaveis = precos.filter(p => !p.un), sobra = [...tocaveis];
  // o nome está certo se o que ele leu contém o da conta: o grão da mesa nas pontas ("ARO * COUVER") não conta
  const nomeCerto = (p, it) => !!p.item && so(p.item).includes(so(it.nome));
  // primeiro os que batem valor e nome, depois só o valor: o 32,90 do Moscow Mule não rouba o da Caipirosca
  const casa = (its, bate) => its.filter(it => {
    const i = sobra.findIndex(p => p.c === it.total && bate(p, it));
    if (i >= 0) sobra.splice(i, 1);
    return i < 0;
  });
  const semNome = casa(conta.itens, nomeCerto), faltou = casa(semNome, () => true);
  const nomes = conta.itens.length - semNome.length;
  const naConta = new Set([...conta.itens.flatMap(it => [it.total, it.un]), conta.servico, conta.total, ...(conta.outros || [])]);
  return { itens: conta.itens.length - faltou.length, nomes, faltou, total: tocaveis.some(p => p.c === conta.total),
    inventou: sobra.filter(p => !naConta.has(p.c)) };
}

(async () => {
  const { srv, porta } = await servir();
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  const linhas = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
    await ctx.route(/fake-db/, r => r.fulfill({ json: r.request().method() === 'GET' && !r.request().url().includes('/pix/') ? DADOS : null }));
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    // guarda o texto da última leitura: o app só mostra os preços, e o --texto quer ver o que ele leu
    if (texto) await p.addInitScript(() => {
      let T; Object.defineProperty(window, 'Tesseract', { configurable: true, get: () => T, set: (v) => {
        T = { ...v, createWorker: async (...a) => { const w = await v.createWorker(...a);
          return { ...w, setParameters: (...b) => w.setParameters(...b), recognize: async (...b) => {
            const r = await w.recognize(...b); window.__lido = r.data.text; return r; } }; } };
      } });
    });
    await p.goto(`http://localhost:${porta}/?evento=${DADOS.name}&mesa`);
    await p.waitForSelector('#whoBtn, #chegada [data-chegou]');
    if (await p.locator('#whoBtn').count()) await p.click('#whoBtn');
    await p.locator('#chegada [data-chegou], #overlayBox [data-sou]', { hasText: /^Lia$/ }).first().click();
    await p.click('#fab'); await p.waitForSelector('#sheet:not(.hidden)');
    const espera = () => p.waitForFunction(() => document.querySelector('#fotoRecado')?.textContent !== 'lendo a conta…', null, { timeout: 120000 });
    for (const conta of contas) {
      await p.setInputFiles('#fotoArq', conta.foto);
      await espera();
      const cinza = await lido(p);
      await p.click('#fotoContraste'); await espera();
      const pb = await lido(p);
      for (const [modo, l] of [['cinza', cinza], ['contraste', pb]]) {
        const n = nota(conta, l);
        linhas.push({ conta: conta.nome, modo, itens: `${n.itens}/${conta.itens.length}`, nome: `${n.nomes}/${conta.itens.length}`,
          total: n.total ? 'sim' : 'não', inventou: n.inventou.length, leu: (l.tempo.match(/leu em ([\d,]+ s)/) || [])[1] || '?' });
        if (detalhe) {
          console.log(`\n${conta.nome} (${modo}): ${l.recado}`);
          if (texto) console.log(l.texto.replace(/^/gm, '  | '));
          for (const q of l.precos) console.log(`  ${q.un ? '·' : ' '} ${reais(q.c).padStart(8)}  ${q.item ? q.item.trim() : ''}`);
          if (n.faltou.length) console.log(`  faltou: ${n.faltou.map(it => `${it.nome} ${reais(it.total)}`).join('; ')}`);
          if (n.inventou.length) console.log(`  inventou: ${n.inventou.map(q => reais(q.c)).join(', ')}`);
        }
      }
      await p.click('#fotoVoltar');
    }
    if (erros.length) console.error('ERROS NA PÁGINA:', erros);
  } finally { await b.close(); srv.close(); }
  if (detalhe) console.log('');
  console.table(linhas);
})().catch(e => { console.error(e); process.exit(1); });
