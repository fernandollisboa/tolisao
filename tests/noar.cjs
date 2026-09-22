// Confere se o site no ar bate com o repositório. Não é teste de navegador: baixa os
// arquivos publicados e compara byte a byte, que é o que engana a gente quando o
// deploy "passou" mas o navegador serve outra coisa.
//   node tests/noar.cjs            -> confere o site oficial
//   node tests/noar.cjs <url base> -> confere outro endereço
const fs = require('fs'), path = require('path'), https = require('https');
const BASE = (process.argv[2] || 'https://fernandollisboa.github.io/tolisao/').replace(/\/?$/, '/');
const RAIZ = path.join(__dirname, '..');

const baixar = url => new Promise((ok, erro) => {
  https.get(url, { headers: { 'cache-control': 'no-cache' } }, r => {
    if (r.statusCode !== 200) { r.resume(); return erro(new Error(`${url} respondeu ${r.statusCode}`)); }
    const pedacos = []; r.on('data', d => pedacos.push(d)); r.on('end', () => ok(Buffer.concat(pedacos)));
  }).on('error', erro);
});

(async () => {
  const falhas = [];
  const html = (await baixar(BASE + '?noar=' + Date.now())).toString();
  const local = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

  if (html.includes('__V__')) falhas.push('index.html no ar ainda tem o placeholder __V__');
  const versao = (html.match(/app\.js\?v=([^"]*)/) || [])[1];
  const esperada = (local.match(/app\.js\?v=([^"]*)/) || [])[1];
  console.log('versão no ar:', versao, '| no repo:', esperada);
  if (versao !== esperada) falhas.push(`o ?v= no ar (${versao}) não é o do repo (${esperada})`);
  if (html !== local) falhas.push('index.html no ar difere do repo');

  for (const arq of ['app.js', 'style.css', 'sw.js']) {
    const url = BASE + arq + (versao ? '?v=' + versao : '');
    const noar = (await baixar(url)).toString();
    const aqui = fs.readFileSync(path.join(RAIZ, arq), 'utf8');
    const igual = noar === aqui;
    console.log(`${arq}: ${igual ? 'igual ao repo' : 'DIFERENTE'} (${url})`);
    if (!igual) falhas.push(`${arq} no ar difere do repo`);
  }

  if (falhas.length) { console.error('\nNÃO ESTÁ NO AR:\n- ' + falhas.join('\n- ')); process.exit(1); }
  console.log('\nno ar e igual ao repo');
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
