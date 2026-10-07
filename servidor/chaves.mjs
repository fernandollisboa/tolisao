// gera o par VAPID (ECDSA P-256) no formato que o Worker lê e grava num JSON pro `wrangler secret bulk`.
//   node chaves.mjs <arquivo.json>
// a privada só vai pro arquivo (o CI apaga depois); na tela sai só a pública.
import { writeFileSync } from 'node:fs';
import { b64url } from './src/vapid.js';

const destino = process.argv[2];
if (!destino) throw new Error('uso: node chaves.mjs <arquivo.json>');
const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const { kty, crv, x, y, d } = await crypto.subtle.exportKey('jwk', par.privateKey);
const publica = b64url(await crypto.subtle.exportKey('raw', par.publicKey));
writeFileSync(
  destino,
  JSON.stringify({ VAPID_PRIVATE: JSON.stringify({ kty, crv, x, y, d }), VAPID_PUBLIC: publica }),
  {
    mode: 0o600,
  },
);
console.log(`VAPID_PUBLIC=${publica}`);
