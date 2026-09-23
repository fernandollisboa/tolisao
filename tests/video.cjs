// Grava um .webm do app fazendo alguma coisa. Preview parado não mostra animação:
//   node tests/video.cjs pix                       -> o copiar pix saindo de trás do ✔
//   node tests/video.cjs ficha --saida=/tmp/f.webm -> a ficha sendo jogada no rodapé
//   node tests/video.cjs risco --vel=0.35          -> o risco correndo nas linhas pagas
// --vel é a velocidade das animações (0.35 = bem devagar, 1 = normal).
const { chromium } = require('./_pw.cjs');
const path = require('path'), fs = require('fs'), os = require('os');
const servir = require('./_serve.cjs');
const { DADOS } = require('./preview.cjs');
const { createHash } = require('crypto');
const sha256 = t => createHash('sha256').update(t).digest('hex');

const H = Date.now();
/** três dívidas pro ✔ piscar linha a linha; só o Fernando tem chave de pix */
const TRES = { name: 'bailedamada', people: DADOS.people,
  expenses: [
    { id: 'i1', desc: 'Airbnb', amount: 300, payer: 'fernando', among: ['fernando','lia'], at: H - 3*86400000 },
    { id: 'i2', desc: 'Gasolina', amount: 120, payer: 'julia', among: ['julia','lia'], at: H - 2*86400000 },
    { id: 'i3', desc: 'Janta', amount: 80, payer: 'mengla', among: ['mengla','lia'], at: H - 86400000 },
  ] };

/** três dívidas e um pagamento já feito: a nota inteira, pra ver a ordem de cima pra baixo */
const FILA = { name: 'bailedamada', people: DADOS.people,
  expenses: [...TRES.expenses,
    { id: 'pg1', kind: 'payment', desc: 'Pagamento', amount: 40, payer: 'lia', among: ['fernando'], at: H - 3600000 }] };

/** dois devedores: o Klinsmann com duas linhas, a Lia com uma. Pra ver a troca de pessoa */
const DOIS = { name: 'bailedamada', people: DADOS.people,
  expenses: [
    { id: 'i1', desc: 'Airbnb', amount: 300, payer: 'fernando', among: ['fernando','lia','klinsmann'], at: H - 3*86400000 },
    { id: 'i2', desc: 'Gasolina', amount: 120, payer: 'julia', among: ['julia','lia','klinsmann'], at: H - 2*86400000 },
  ] };

/** cada cena diz quem você é, quanto o pix demora e o que a câmera faz */
const CENAS = {
  pix: { nome: 'copiar pix brotando do ✔ e a piscada verde', quem: 'Lia', atrasoPix: 2000,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForSelector('#mineRows [data-pix]', { timeout: 8000 }); await p.waitForTimeout(4500); } },
  cascata: { nome: 'a nota se preenchendo de cima pra baixo', quem: 'Lia', atrasoPix: 1200, dados: FILA,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1200);
      await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await p.waitForTimeout(5500);
      await p.evaluate(() => document.querySelector('#settle').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await p.waitForTimeout(6000); } },
  piscas: { nome: 'três ✔ piscando um atrás do outro', quem: 'Lia', atrasoPix: 2000, dados: TRES,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForSelector('#mineRows [data-pix]', { timeout: 8000 }); await p.waitForTimeout(6000); } },
  troca: { nome: 'trocar de pessoa refaz a nota inteira', quem: 'Klinsmann', atrasoPix: 800, dados: DOIS,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(4500);
      await p.click('#whoBtn'); await p.waitForSelector('#whoSel');
      await p.selectOption('#whoSel', { label: 'Lia' });
      await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(5000); } },
  chave: { nome: 'o cadastrar chave pix descendo do título', quem: 'Júlia', atrasoPix: 2500,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForSelector('#pixBtn', { timeout: 9000 }); await p.waitForTimeout(4000); } },
  ficha: { nome: 'a ficha caindo quando a página acaba', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
      await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
      await p.waitForTimeout(5000); } },
  risco: { nome: 'o risco correndo nas linhas pagas', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await p.evaluate(() => document.querySelector('#settle').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(3500); } },
};

/**
 * @param {{cena?:string, vel?:number, largura?:number, altura?:number, dados?:any, css?:string, saida?:string, porta?:number}} opts
 * @returns {Promise<string>} caminho do vídeo
 */
async function video(opts = {}) {
  const { cena = 'pix', vel = 0.5, largura = 390, altura = 844,
          porta = 4500 + Math.floor(Math.random()*200) } = opts;
  const c = CENAS[cena]; if (!c) throw new Error(`cena desconhecida: ${cena} (tem ${Object.keys(CENAS).join(', ')})`);
  const dados = opts.dados || c.dados || DADOS;
  const saida = opts.saida || path.join(os.tmpdir(), `video-${cena}.webm`);
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'tolisa-vid-'));
  const srv = servir(porta);
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: largura, height: altura },
      recordVideo: { dir: pasta, size: { width: largura, height: altura } } });
    await ctx.route(/fake-db/, async r => {
      const u = r.request().url();
      // o pix chega depois do resto, como no mundo real: é isso que a animação conta
      if (u.includes('/pix/')) { if (c.atrasoPix) await new Promise(ok => setTimeout(ok, c.atrasoPix));
        return r.fulfill({ json: u.includes('/fernando/') ? 'fernando@exemplo.com' : null }); }
      if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
      r.fulfill({ json: dados });
    });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    // entra já identificado: senão o vídeo começa com a tela de código e o cartão de
    // "quem é você?" piscando, e o que interessa fica no fim
    const sala = await sha256(dados.name);
    await p.addInitScript(([sala, code, quem, gente]) => {
      try { localStorage.setItem('racha:room', JSON.stringify({ code, id: sala }));
        const eu = gente.find(x => x.name === quem);
        if (eu) localStorage.setItem(`racha:${sala}:me`, eu.id); } catch {}
    }, [sala, dados.name, c.quem, dados.people]);
    // o navegador roda as animações mais devagar, senão some antes de dar pra ver
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: vel });
    await p.goto(`http://localhost:${porta}/#c=${dados.name}`);
    // css de experiência: entra depois da folha do app, então redefine keyframes e vence
    if (opts.css) await p.addStyleTag({ content: opts.css });
    await p.waitForSelector('#mine:not(.hidden)', { timeout: 8000 });
    await c.acao(p);
    if (erros.length) console.error('ERROS NA PÁGINA:', erros);
    const v = p.video(); await ctx.close();
    if (v) await v.saveAs(saida);
    return saida;
  } finally { await b.close(); srv.close(); fs.rmSync(pasta, { recursive: true, force: true }); }
}

module.exports = { video, CENAS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const cena = args.find(a => !a.startsWith('--')) || 'pix';
  const op = a => { const v = args.find(x => x.startsWith('--' + a + '=')); return v && v.split('=')[1]; };
  const arqCss = op('css');
  video({ cena, saida: op('saida'), vel: op('vel') ? Number(op('vel')) : undefined,
          css: arqCss ? fs.readFileSync(arqCss, 'utf8') : undefined,
          largura: op('largura') ? Number(op('largura')) : undefined })
    .then(f => console.log(f)).catch(e => { console.error('FAIL', e); process.exit(1); });
}
