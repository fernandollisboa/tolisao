const { createHash } = require('crypto');
const sha256 = t => createHash('sha256').update(t).digest('hex');

class Banco {
  constructor(op = {}) { this.arvore = { rooms: {}, pix: {} }; this.listagens = 0; this.atrasoPix = op.atrasoPix || 0; this.congelado = !!op.congelado; }
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
        if (!this.congelado) this.arvore.rooms[partes[1]] = v; return json(200, v); }
      return json(400, { error: 'o app só grava a sala inteira' });
    });
  }
}

module.exports = { Banco, sha256 };
