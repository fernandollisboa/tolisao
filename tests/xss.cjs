// Nome e descrição hostis não viram HTML, e id que não casa com /^[a-z0-9]{1,32}$/
// não entra em atributo nenhum.
const { abre } = require('./_app.cjs');

const mal = { name: 'bailedamada', updatedAt: 1, people: [
    { id: 'fernando', name: 'Fernando', at: 1 }, { id: 'lia', name: '<img src=x onerror="window.__xss=1">Lia', at: 2 },
    { id: 'x" onmouseover="window.__xss=2" data-y="', name: 'Hacker', at: 3 } ],
  expenses: [ { id: 'a', desc: '<script>window.__xss=3</script>Cerveja', amount: 90, payer: 'fernando', among: ['fernando', 'lia'], at: 3, by: '<b>x</b>' },
    { id: 'b"><img src=x onerror="window.__xss=4">', desc: 'Ruim', amount: 10, payer: 'fernando', among: ['lia'], at: 4 },
    { id: 'c', desc: 'Sem payer válido', amount: 10, payer: 'x" onmouseover="window.__xss=2" data-y="', among: ['lia'], at: 5 } ], deleted: [] };

(async () => {
  const app = await abre({ dados: mal, quem: 'Fernando',
    pix: { lia: '<img src=x onerror="window.__xss=5">' } });
  const p = app.p; const erros = app.erros;
  const exige = (ok, msg) => { if (!ok) erros.push(msg); };
  try {
    await p.waitForTimeout(800);
    await p.click('#itemsHead'); await p.waitForTimeout(100);
    await p.evaluate(() => document.getElementById('peopleSec').classList.remove('hidden'));
    const r = await p.evaluate(() => ({ xss: window.__xss,
      gente: [...document.querySelectorAll('#peopleLine .nm')].map(e => e.textContent),
      itens: [...document.querySelectorAll('#expenses .item .l')].map(e => e.textContent.trim()),
      pixBtns: document.querySelectorAll('[data-pix]').length,
      imgs: document.querySelectorAll('img:not(.stain)').length }));
    console.log(JSON.stringify(r));
    exige(r.xss === undefined, `alguma coisa executou: window.__xss = ${r.xss}`);
    exige(r.gente.length === 2, `id hostil virou pessoa: ${r.gente.length} nomes`);
    exige(r.itens.length === 1, `passou item com id ou pagador hostil: ${r.itens.length}`);
    exige(r.itens[0] && r.itens[0].includes('<script>'), 'o <script> do texto devia aparecer escrito, não sumir');
    exige(r.pixBtns === 0, 'chave de pix hostil virou botão');
    exige(r.imgs === 0, 'entrou <img> que o app não pôs');
    console.log('nada de hostil virou HTML:', erros.length ? 'FALHOU' : 'ok', '| errors:', erros);
  } finally { await app.fecha(); }
  if (erros.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
