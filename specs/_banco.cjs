const { createHash } = require('crypto');
const sha256 = t => createHash('sha256').update(t).digest('hex');

class Banco {
  constructor(op = {}) { this.arvore = { rooms: {}, pix: {}, visitas: {} }; this.listagens = 0; this.atrasoPix = op.atrasoPix || 0; this.congelado = !!op.congelado; }
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
        // a rede engasgou: o banco não responde a chave (como um 5xx do Firebase no bar)
        if (this.pixFora && m === 'GET') { this.pixFalhas = (this.pixFalhas || 0) + 1; return json(503, { error: 'fora do ar' }); }
        const cur = this.pega(['pix', sala, pessoa]);
        if (m === 'GET') return filho === 'key' ? json(200, cur ? cur.key : null) : nega();
        if (m !== 'PUT' || filho) return nega();
        const novo = JSON.parse(rq.postData() || 'null');
        if (cur && cur.key !== '' && cur.tok !== novo?.tok) return nega();
        if (!this.congelado) (this.arvore.pix[sala] ||= {})[pessoa] = novo;
        return json(200, novo);
      }
      // visitas/<dia> só se soma: PUT de +1, ninguém lê nem apaga
      if (partes[0] === 'visitas') {
        const [, dia] = partes, sv = JSON.parse(rq.postData() || 'null')?.['.sv']?.increment;
        if (m !== 'PUT' || partes.length !== 2 || !/^20[0-9]{2}-[01][0-9]-[0-3][0-9]$/.test(dia) || sv !== 1) return nega();
        this.arvore.visitas[dia] = (this.arvore.visitas[dia] || 0) + 1;
        return r.fulfill({ status: 204 });
      }
      if (partes[0] !== 'rooms' || partes.length < 2) { if (m === 'GET') this.listagens++; return nega(); }
      // o ETag como o Firebase: só vem se pedir, e o PUT com if-match velho leva 412 com a sala atual
      const tag = () => { const v = this.pega(partes); return v == null ? 'null_etag' : sha256(JSON.stringify(v)); };
      const comTag = (status, v) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(v),
        headers: { etag: tag(), 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag' } });
      if (m === 'GET') return rq.headers()['x-firebase-etag'] === 'true' ? comTag(200, this.pega(partes)) : json(200, this.pega(partes));
      if (m === 'PUT' && partes.length === 2) { const v = JSON.parse(rq.postData() || 'null');
        if (this.noMeio?.(partes[1], v)) this.noMeio = null;
        const se = rq.headers()['if-match'];
        if (se && se !== tag()) return comTag(412, this.pega(partes));
        if (!this.congelado) this.arvore.rooms[partes[1]] = v; return json(200, v); }
      return json(400, { error: 'o app só grava a sala inteira' });
    });
  }
}

module.exports = { Banco, sha256 };
