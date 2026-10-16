// as imagens e o gif do README, em docs/readme/: npm run readme. Não é teste, igual o preview.cjs e o video.cjs
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const { preview, DADOS } = require('./preview.cjs');
const { video, CENAS } = require('./video.cjs');

const PASTA = path.join(__dirname, '..', 'docs', 'readme');
const em = nome => path.join(PASTA, nome);
// o README é vitrine: gente e evento de mentira, no lugar dos nomes dos dados de exemplo (os ids ficam)
const NOMES = { fernando: 'Gumercindo', julia: 'Clotilde', lia: 'Zuza', mengla: 'Dagmar', klinsmann: 'Rosicleide' };
const falsa = d => ({ ...d, name: 'farofadaboa', people: d.people.map(x => ({ ...x, name: NOMES[x.id] || x.name })) });
const tema = t => `try { localStorage.setItem('tolisa', JSON.stringify({ tema: '${t}' })) } catch {}`;

(async () => {
  fs.mkdirSync(PASTA, { recursive: true });
  // a estreia, sem evento
  await preview({ inicio: true, quieto: true, alvo: '#overlay .paper', saida: em('inicio.png') });
  // a nota da Lia nos três temas que se escolhem no pé da nota (o "celular" é um deles, conforme o aparelho)
  const dados = falsa(DADOS), quem = NOMES.lia;
  for (const t of ['papel', 'neon', 'grafite'])
    await preview({ dados, quem, quieto: true, js: t === 'papel' ? undefined : tema(t), saida: em(`tema-${t}.png`) });
  // anotando um gasto
  await preview({ dados, quem, quieto: true, recorte: { x: 0, y: 0, width: 390, height: 844 }, altura: 844, saida: em('anotar.png'),
    acao: async p => { await p.click('#fab'); await p.waitForSelector('#sheet:not(.hidden)');
      await p.type('#amount', '12000'); await p.fill('#desc', 'Pizza'); await p.locator('#desc').blur();
      await p.waitForTimeout(600); } });
  // a imagem que vai pro zap
  await preview({ dados, quem, comanda: true, saida: em('comanda.png') });

  // o passeio: grava em webm e vira gif (o README do GitHub não toca vídeo do repositório)
  const webm = path.join(os.tmpdir(), 'tolisa-passeio.webm');
  await video({ cena: 'passeio', dados: falsa(CENAS.passeio.dados), saida: webm });
  // o começo do vídeo é a página em branco carregando
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '0.8', '-i', webm, '-vf',
    'fps=12,scale=300:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
    em('passeio.gif')]);
  for (const f of fs.readdirSync(PASTA)) console.log(f, Math.round(fs.statSync(em(f)).size / 1024) + ' KB');
})().catch(e => { console.error(e); process.exit(1); });
