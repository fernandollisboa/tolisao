// imita a API do aviso (servidor/): só anota o que o app pediu. O push de verdade
// (navegador → serviço de push → sw.js) não dá pra testar aqui: confere à mão no celular
const { API_FALSA } = require('./_serve.cjs');

class Api {
  constructor() { this.pedidos = []; }
  rota(nome) { return this.pedidos.filter(p => p.rota === nome); }

  async liga(ctx) {
    await ctx.route(API_FALSA + '/**', async r => {
      const rq = r.request(), rota = new URL(rq.url()).pathname;
      const json = (status, v) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(v), headers: { 'access-control-allow-origin': '*' } });
      if (rq.method() === 'GET' && rota === '/chave') return json(200, { chave: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' });
      if (rq.method() !== 'POST') return json(405, { erro: 'só POST' });
      let corpo = null; try { corpo = JSON.parse(rq.postData() || 'null'); } catch {}
      this.pedidos.push({ rota, corpo });
      return json(200, { ok: true });
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
