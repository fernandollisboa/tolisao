// a ficha pegável: dois toques treme, o terceiro agarra, solta devagar boia, arremesso joga fora.
// As checagens moram na cena 'pega' do video.cjs, que também serve pra gravar o vídeo.
const { video } = require('./video.cjs'); const os = require('os'), path = require('path'), fs = require('fs');
const saida = path.join(os.tmpdir(), 'pega-teste.webm');
video({ cena: 'pega', vel: 1, saida }).then(() => { fs.rmSync(saida, { force: true }); console.log('pega: ok'); })
  .catch(e => { console.error('FAIL', e.message); process.exit(1); });
