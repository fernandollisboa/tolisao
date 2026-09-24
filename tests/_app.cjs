// Cenário pronto pros testes: porta livre, Firebase de mentira com as regras do pix,
// navegador aberto e já identificado. Cada teste fica só com o que é dele.
//
//   const app = await abre({ semente: true, quem: 'Lia' });
//   ... o que o teste veio fazer, em app.p ...
//   await app.fecha();
//
// `abre` devolve também `aba()`, que é outro aparelho no mesmo banco, e `loja`, que
// é o que ficou gravado — dá pra conferir o que o app escreveu sem adivinhar pela tela.
const { chromium } = require('./_pw.cjs');
const servir = require('./_serve.cjs');
const fs = require('fs'), path = require('path');
const { createHash } = require('crypto');

const sha256 = t => createHash('sha256').update(t).digest('hex');
const SEMENTE = () => fs.readFileSync(path.join(__dirname, 'seed.b64'), 'utf8').trim();
const CODIGO = 'bailedamada';

/**
 * Banco de mentira, com as regras do README: só `/key` é legível, e quem troca a
 * chave é o `tok` que a gravou. O resto é PUT grava, GET devolve o que gravou.
 * @param {{dados?:any, pix?:Record<string,string>, atrasoPix?:number}} opts
 */
function banco({ dados = null, pix = {}, atrasoPix = 0 } = {}) {
  /** @type {Record<string,string>} */ const loja = Object.create(null);
  const contas = { listagens: 0 };   // o app não pode listar eventos: isso tem que ficar em 0
  const json = v => ({ status: 200, contentType: 'application/json', body: JSON.stringify(v ?? null) });
  const cru = b => ({ status: 200, contentType: 'application/json', body: b });
  const negado = () => ({ status: 401, contentType: 'application/json', body: '{"error":"Permission denied"}' });

  /** @param {import('playwright').Route} r */
  async function rota(r) {
    const rq = r.request(), m = rq.method(), caminho = new URL(rq.url()).pathname;

    const mp = caminho.match(/^\/pix\/([^/]+)\/([^/]+)(\/key)?\.json$/);
    if (mp) {
      // a chave chega depois do resto, como no mundo real: é isso que a animação conta
      if (atrasoPix) await new Promise(ok => setTimeout(ok, atrasoPix));
      const no = `/pix/${mp[1]}/${mp[2]}`, eKey = !!mp[3];
      if (m === 'PUT') {
        if (eKey) return r.fulfill(negado());   // a regra deixa escrever o nó, não o filho
        const tinha = loja[no] ? JSON.parse(loja[no]) : null;
        const vem = JSON.parse(rq.postData() || 'null');
        if (tinha && tinha.tok !== (vem && vem.tok)) return r.fulfill(negado());
        loja[no] = rq.postData() || 'null'; return r.fulfill(cru(loja[no]));
      }
      if (!eKey) return r.fulfill(negado());    // ler o nó inteiro exporia o tok
      const guardada = loja[no] ? JSON.parse(loja[no]).key : null;
      return r.fulfill(json(guardada ?? pix[mp[2]] ?? null));
    }
    if (caminho.startsWith('/pix/')) return r.fulfill(negado());
    if (caminho === '/rooms.json') { contas.listagens++; return r.fulfill(negado()); }

    if (m === 'PUT') { loja[caminho] = rq.postData() || 'null'; return r.fulfill(cru(loja[caminho])); }
    if (loja[caminho] !== undefined) return r.fulfill(cru(loja[caminho]));
    // sem nada gravado, um evento existe se o teste deu `dados`; senão não existe
    return r.fulfill(json(/^\/rooms\/[^/]+\.json$/.test(caminho) ? dados : null));
  }
  return { rota, loja, contas };
}

/**
 * @param {{dados?:any, quem?:string|null, pix?:Record<string,string>, atrasoPix?:number,
 *          semente?:boolean, codigo?:string, largura?:number, altura?:number, escala?:number,
 *          toque?:boolean, baixar?:boolean, movimento?:'reduce'|'no-preference',
 *          inicio?:Function|string}} opts
 */
async function abre(opts = {}) {
  const { dados = null, quem = null, pix = {}, atrasoPix = 0, semente = false,
          largura = 390, altura = 844, escala = 1, toque = false, baixar = false, movimento, inicio } = opts;
  const codigo = opts.codigo || (dados && dados.name) || CODIGO;
  const bd = banco({ dados, pix, atrasoPix });
  const srv = servir(0); const porta = await srv.pronto;
  const b = await chromium.launch();
  /** @type {string[]} */ const erros = [];
  /** @type {import('playwright').BrowserContext[]} */ const abas = [];

  /** outro aparelho no mesmo banco: contexto novo, localStorage novo */
  async function aba(dono = {}) {
    const { quem: eu = null, largura: l = largura, altura: a = altura, primeira = false,
            inicio: meuInicio = null } = dono;
    const ctx = await b.newContext({ viewport: { width: l, height: a }, deviceScaleFactor: escala,
      hasTouch: toque, acceptDownloads: baixar, ...(movimento ? { reducedMotion: movimento } : {}) });
    abas.push(ctx);
    await ctx.route(/fake-db/, bd.rota);
    // o que o teste quer ouvir (ou plantar no aparelho) tem que estar de pé antes do app
    for (const i of [inicio, meuInicio]) if (i) await ctx.addInitScript(/** @type {any} */ (i));
    const p = await ctx.newPage();
    p.on('pageerror', e => erros.push(`${eu || 'aparelho'}: ${e.message}`));
    // a primeira aba pode plantar o evento pela semente; as outras já o encontram pronto
    if (primeira && semente) {
      await p.goto(`http://localhost:${porta}/#seed=${SEMENTE()}`);
      await p.fill('#gateCode', codigo); await p.click('#gateForm button');
    } else {
      await p.goto(`http://localhost:${porta}/#c=${encodeURIComponent(codigo)}`);
    }
    await p.waitForSelector('#whoBtn', { timeout: 9000 });
    if (eu) { await p.click('#whoBtn'); await p.waitForSelector('#whoSel');
      await p.selectOption('#whoSel', { label: eu });
      await p.waitForFunction(n => (document.querySelector('#whoLine') || {}).textContent.includes(n), eu, { timeout: 5000 }); }
    return p;
  }

  const p = await aba({ quem, primeira: true });
  return { p, aba, b, porta, url: `http://localhost:${porta}`,
    loja: bd.loja, contas: bd.contas, erros, sala: sha256(codigo), codigo,
    fecha: async () => { await b.close(); srv.close(); } };
}

module.exports = { abre, banco, sha256, CODIGO };
