const { createHash } = require('crypto');
const sha256 = t => createHash('sha256').update(t).digest('hex');

// o .validate de rooms/$room do database.rules.json, em js. O Firebase guarda lista como objeto de
// índices e some com lista vazia: aqui a lista do JSON passa pelo mesmo Object.entries
const ID = /^[a-z0-9]{1,32}$/;
const obj = x => x !== null && typeof x === 'object';
const so = (o, campos) => Object.keys(o).every(k => campos.includes(k));
const talvez = (x, ok) => x === undefined || ok(x);
const txt = (x, n) => typeof x === 'string' && x.length <= n;
const id = x => typeof x === 'string' && ID.test(x);
const num = x => typeof x === 'number';
const lista = (x, chave, ok) => x === undefined || (obj(x) && Object.entries(x).every(([k, v]) => chave.test(k) && ok(v)));
const pessoa = p => obj(p) && so(p, ['id', 'name', 'at']) && id(p.id) && txt(p.name, 30) && talvez(p.at, num);
const gasto = e => obj(e) && so(e, ['id', 'desc', 'amount', 'payer', 'among', 'at', 'kind', 'by', 'shares'])
  && id(e.id) && id(e.payer) && num(e.amount) && Math.abs(e.amount) < 1e10 && talvez(e.desc, x => txt(x, 60))
  && e.among !== undefined && lista(e.among, /^[0-9]{1,2}$/, id) && talvez(e.at, num)
  && talvez(e.kind, k => k === 'payment') && talvez(e.by, x => txt(x, 30)) && lista(e.shares, ID, x => num(x) && x >= 0);
// o que o Firebase guarda: null, lista vazia e objeto vazio somem
const guardado = v => { if (!obj(v)) return v; const o = {};
  for (const [k, x] of Object.entries(v)) { const g = guardado(x); if (g !== null && g !== undefined) o[k] = g; }
  return Object.keys(o).length ? o : undefined; };
const salaValida = (sala, v) => /^[0-9a-f]{64}$/.test(sala) && obj(v) && so(v, ['v', 'name', 'updatedAt', 'people', 'expenses', 'deleted'])
  && v.v === 2 && num(v.updatedAt) && talvez(v.name, x => txt(x, 40))
  && lista(v.people, /^[0-9]{1,3}$/, pessoa) && lista(v.expenses, /^[0-9]{1,4}$/, gasto) && lista(v.deleted, /^[0-9]{1,3}$/, id);

class Banco {
  constructor(op = {}) { this.arvore = { rooms: {}, pix: {} }; this.listagens = 0; this.recusas = 0; this.atrasoPix = op.atrasoPix || 0; this.congelado = !!op.congelado; }
  sala(dados) { const id = sha256(dados.name); this.arvore.rooms[id] = dados; return id; }
  pix(sala, pessoa, key) { (this.arvore.pix[sala] ||= {})[pessoa] = { key, tok: 'tok-de-outro-aparelho' }; }
  pega(partes) { let n = this.arvore; for (const p of partes) { if (n == null || typeof n !== 'object') return null; n = n[p]; } return n ?? null; }

  async liga(ctx) {
    await ctx.route('https://fake-db.firebaseio.com/**', async r => {
      const rq = r.request(), m = rq.method(), partes = new URL(rq.url()).pathname.replace(/\.json$/, '').split('/').filter(Boolean);
      const json = (status, v) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(v) });
      const nega = () => json(401, { error: 'Permission denied' });
      if (partes[0] === 'pix') {
        if (this.atrasoPix) await new Promise(ok => setTimeout(ok, this.atrasoPix));
        const [, sala, pessoa, filho] = partes; if (!sala || !pessoa) return nega();
        const cur = this.pega(['pix', sala, pessoa]);
        if (m === 'GET') return filho === 'key' ? json(200, cur ? cur.key : null) : nega();
        if (m !== 'PUT' || filho) return nega();
        const novo = JSON.parse(rq.postData() || 'null');
        if (cur && cur.tok !== novo?.tok) return nega();
        if (!this.congelado) (this.arvore.pix[sala] ||= {})[pessoa] = novo;
        return json(200, novo);
      }
      if (partes[0] !== 'rooms' || partes.length < 2) { if (m === 'GET') this.listagens++; return nega(); }
      if (m === 'GET') return json(200, this.pega(partes));
      if (m === 'PUT' && partes.length === 2) { const v = JSON.parse(rq.postData() || 'null');
        if (v !== null && !salaValida(partes[1], guardado(v))) { this.recusas++; return nega(); }
        if (!this.congelado) this.arvore.rooms[partes[1]] = v; return json(200, v); }
      return json(400, { error: 'o app só grava a sala inteira' });
    });
  }
}

module.exports = { Banco, sha256 };
