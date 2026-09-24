// Runner de bolso: roda os testes em sequência e resume no fim.
//   node tests/run-all.cjs            -> todos
//   node tests/run-all.cjs pix xss    -> só esses
//   node tests/run-all.cjs --lista    -> os nomes que existem
//   node tests/run-all.cjs --segue    -> não para no primeiro que falhar
// Quem imprime o que checou é cada teste; aqui só sai o placar.
const { spawnSync } = require('child_process'); const path = require('path');
const TESTES = ['ui', 'feat', 'pix', 'ordem', 'img', 'xss', 'pega', 'dica'];

const args = process.argv.slice(2);
const segue = args.includes('--segue');
if (args.includes('--lista')) { console.log(TESTES.join(' ')); process.exit(0); }

const pedidos = args.filter(a => !a.startsWith('--'));
const desconhecido = pedidos.find(a => !TESTES.includes(a));
if (desconhecido) { console.error(`teste desconhecido: ${desconhecido} (tem ${TESTES.join(', ')})`); process.exit(2); }
const fila = pedidos.length ? pedidos : TESTES;

const placar = [];
for (const t of fila) {
  console.log(`\n=== ${t}`);
  const ini = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, t + '.cjs')], { stdio: 'inherit' });
  placar.push({ t, ok: r.status === 0, ms: Date.now() - ini });
  if (r.status !== 0 && !segue) break;
}

const falhou = placar.filter(p => !p.ok);
console.log('');
for (const p of placar) console.log(`${p.ok ? 'ok  ' : 'FALHOU'} ${p.t.padEnd(6)} ${(p.ms / 1000).toFixed(1)}s`);
const pulados = fila.length - placar.length;
if (pulados) console.log(`${pulados} não rodou (use --segue pra ir até o fim)`);
console.log(falhou.length ? `\n${falhou.length} de ${fila.length} falhou: ${falhou.map(p => p.t).join(', ')}` : '\ntudo ok');
process.exit(falhou.length ? 1 : 0);
