// a ficha pegável: dois toques treme, o terceiro agarra, solta devagar boia, arremesso joga fora.
// E o easter egg: segura, toca, segura na ficha desliga a diva; o mesmo no rodapé liga de volta.
// As checagens moram nas cenas 'pega' e 'chato' do video.cjs, que também servem pra gravar o vídeo.
const { video } = require('./video.cjs'); const os = require('os'), path = require('path'), fs = require('fs');
(async () => { for (const cena of ['pega', 'chato']) {
  const saida = path.join(os.tmpdir(), `${cena}-teste.webm`); await video({ cena, vel: 1, saida }); fs.rmSync(saida, { force: true }); }
  console.log('pega: ok'); })().catch(e => { console.error('FAIL', e.message); process.exit(1); });
