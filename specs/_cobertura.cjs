// quanto do app.js os cenários executam, pela cobertura V8 do próprio chromium.
// `npm run cobertura` (ou `npm run cobertura -- pix`) roda os testes com ela ligada e
// mostra o % de linhas e os trechos que nenhum cenário alcançou. É lanterna pra achar
// fluxo sem cenário, não meta: animação e gesto se conferem no vídeo, não aqui.
// O sw.js fica de fora: o service worker não entra na cobertura da página.
const fs = require('fs'), path = require('path');

const DIR = path.join(__dirname, '.cobertura');
const ligada = !!process.env.COBERTURA;

// ---------- dentro dos testes: cada aba grava o que rodou do app.js ----------
async function liga(p) { if (ligada) await p.coverage.startJSCoverage({ resetOnNavigation: false }); }
async function guarda(contextos) {
  if (!ligada) return;
  for (const p of contextos.flatMap(c => c.pages())) {
    const c = await p.coverage.stopJSCoverage().catch(() => []);
    const app = c.filter(e => new URL(e.url).pathname === '/app.js');
    if (app.length) fs.writeFileSync(path.join(DIR, `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`), JSON.stringify(app));
  }
}

// ---------- o relatório: junta as abas e traduz os trechos do V8 em linhas ----------
function relatorio() {
  // vale o texto servido, não o do disco: o _serve.cjs troca o DB pelo banco falso
  // (na mesma linha, então a numeração é a do app.js)
  let fonte = null, rodou = null;
  for (const f of fs.readdirSync(DIR)) for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
    fonte ??= e.source; rodou ??= new Uint8Array(fonte.length);
    if (e.source !== fonte) continue;   // app.js mudou no meio da rodada: essa aba não vale
    // os trechos do V8 se aninham: pinta do maior pro menor, e o de dentro vence
    const conta = new Int32Array(fonte.length);
    const trechos = e.functions.flatMap(fn => fn.ranges).sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
    for (const t of trechos) conta.fill(t.count, t.startOffset, t.endOffset);
    for (let i = 0; i < conta.length; i++) if (conta[i] > 0) rodou[i] = 1;
  }
  // conta linha com código; comentário, linha em branco e fecha-chave sozinho não contam.
  // Linha em que qualquer pedaço rodou conta inteira: `if (x) return y` sai coberta
  // mesmo sem o return, então o % é otimista
  if (!fonte) return console.log('cobertura: nenhuma aba gravou o app.js');
  const linhas = fonte.split('\n'), faltam = []; let ini = 0, total = 0;
  linhas.forEach((l, n) => {
    const t = l.trim();
    if (t && !/^(\/\/|\/\*|\*)/.test(t) && !/^[})\];,]+$/.test(t)) {
      total++;
      let ok = false; for (let i = 0; i < l.length && !ok; i++) ok = !/\s/.test(l[i]) && !!rodou[ini + i];
      if (!ok) faltam.push(n + 1);
    }
    ini += l.length + 1;
  });
  const blocos = [];
  for (const n of faltam) { const b = blocos.at(-1); if (b && n - b[1] <= 2) b[1] = n; else blocos.push([n, n]); }
  const pct = (100 * (total - faltam.length) / total).toFixed(1);
  console.log(`\ncobertura do app.js: ${pct}% das linhas (${total - faltam.length} de ${total})`);
  console.log('\nsem cenário, dos trechos maiores pros menores:');
  for (const [a, b] of [...blocos].sort((x, y) => (y[1] - y[0]) - (x[1] - x[0])).slice(0, 20))
    console.log(`  app.js:${a === b ? a : `${a}-${b}`}  ${linhas[a - 1].trim().slice(0, 80)}`);
  if (blocos.length > 20) console.log(`  … e mais ${blocos.length - 20} trechos de uma ou duas linhas`);
}

if (require.main === module) {
  fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = require('child_process').spawnSync(npm, ['test', '--', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, COBERTURA: '1' }, shell: process.platform === 'win32' });
  relatorio();
  process.exit(r.status ?? 1);
}

module.exports = { liga, guarda };
