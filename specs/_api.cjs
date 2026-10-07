// imita a API do aviso (servidor/): só anota o que o app pediu. O push de verdade
// (navegador → serviço de push → sw.js) não dá pra testar aqui: confere à mão no celular.
// A digital (/digital/…) é o Worker de verdade, com um KV em memória: a assinatura se confere igual
const { API_FALSA } = require('./_serve.cjs');
const path = require('path'), { pathToFileURL } = require('url');
const worker = import(pathToFileURL(path.join(__dirname, '..', 'servidor', 'src', 'index.js')).href);

/** o KV da Cloudflare em memória, só o que o Worker usa */
function kvNaMemoria() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; },
  };
}

class Api {
  // origens: de onde a digital vale (o endereço do site falso); o rpId sai delas, como no Worker
  constructor() { this.pedidos = []; this.kv = kvNaMemoria(); this.origens = ''; }
  rota(nome) { return this.pedidos.filter(p => p.rota === nome); }

  async worker(m, rota, texto, origem) {
    const { default: w } = await worker;
    const r = await w.fetch(new Request('https://api.falsa' + rota, { method: m, headers: origem ? { Origin: origem } : {}, body: m === 'POST' ? texto || '' : undefined }),
      { KV: this.kv, DIGITAL_ORIGENS: this.origens });
    return { status: r.status, corpo: await r.json(), cabecalhos: { 'access-control-allow-origin': '*' } };
  }

  // a API numa função, como o banco: a rota do playwright e o npm run dev chamam a mesma
  responde(m, rota, texto, origem = '') {
    const json = (status, v) => ({ status, corpo: v, cabecalhos: { 'access-control-allow-origin': '*' } });
    if (rota.startsWith('/digital/')) { this.pedidos.push({ rota, corpo: null }); return this.worker(m, rota, texto, origem); }
    if (m === 'GET' && rota === '/chave') return json(200, { chave: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' });
    if (m !== 'POST') return json(405, { erro: 'só POST' });
    let corpo = null; try { corpo = JSON.parse(texto || 'null'); } catch {}
    this.pedidos.push({ rota, corpo });
    return json(200, { ok: true });
  }

  async liga(ctx) {
    await ctx.route(API_FALSA + '/**', async r => {
      const rq = r.request(), res = await this.responde(rq.method(), new URL(rq.url()).pathname, rq.postData(), rq.headers()['origin']);
      return r.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(res.corpo), headers: res.cabecalhos });
    });
  }
}

// um celular que aceita aviso: permissão concedida no toque e uma inscrição de push de mentira.
// O headless não fala com serviço de push nenhum, então o navigator.serviceWorker também é de mentira
function celularComAviso() {
  const w = /** @type {any} */ (window);
  let permissao = 'default';
  class Aviso { static get permission() { return permissao; } static async requestPermission() { return (permissao = 'granted'); } }
  w.Notification = Aviso;
  w.PushManager ||= function PushManager() {};
  let sub = null;
  const nova = () => ({ endpoint: 'https://push.exemplo/celular-de-teste', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'BFalsa', auth: 'falsa' } }; }, unsubscribe: async () => { sub = null; return true; } });
  const reg = { pushManager: { getSubscription: async () => sub, subscribe: async () => (sub = nova()) } };
  Object.defineProperty(navigator, 'serviceWorker', { value: { register: async () => reg, ready: Promise.resolve(reg) } });
}

module.exports = { Api, celularComAviso };
