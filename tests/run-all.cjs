// roda todos os testes em sequência; qualquer saída != 0 encerra com erro
const { spawnSync } = require('child_process'); const path = require('path');
const tests = ['ui', 'feat', 'pix', 'ordem', 'img', 'xss', 'pega'];
for (const t of tests) { console.log(`\n=== ${t}`); const r = spawnSync(process.execPath, [path.join(__dirname, t + '.cjs')], { stdio: 'inherit' }); if (r.status !== 0) { console.error(`FALHOU: ${t}`); process.exit(1); } }
console.log('\ntudo ok');
