// VAPID (RFC 8292) só com WebCrypto: o JWT ES256 que diz ao serviço de push quem manda.
// O push vai sem conteúdo (sem aes128gcm): o service worker do site busca a sala e monta o texto.
//
// As chaves moram nos secrets do Worker:
//   VAPID_PRIVATE: a chave privada P-256 como JWK em JSON ({kty, crv, x, y, d})
//   VAPID_PUBLIC: a mesma chave pública, ponto não comprimido (65 bytes) em base64url
// quem gera é o `chaves.mjs`, na primeira subida do servidor.yml.

const texto = new TextEncoder();

/** @param {ArrayBuffer | Uint8Array} buf */
export function b64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} s */
export function deB64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** @type {Map<string, Promise<CryptoKey>>} */
const chaves = new Map();
/** @param {string} jwk */
function chavePrivada(jwk) {
  if (!chaves.has(jwk)) {
    const { kty, crv, x, y, d } = JSON.parse(jwk);
    chaves.set(
      jwk,
      crypto.subtle.importKey('jwk', { kty, crv, x, y, d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']),
    );
  }
  return /** @type {Promise<CryptoKey>} */ (chaves.get(jwk));
}

/**
 * O JWT de um envio: `aud` é a origem do endpoint, vale 12 h.
 * @param {string} endpoint
 * @param {{ VAPID_PRIVATE: string, VAPID_SUB?: string }} env
 * @param {number} [agora] em segundos
 */
export async function jwt(endpoint, env, agora = Math.floor(Date.now() / 1000)) {
  const cabeca = b64url(texto.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corpo = b64url(
    texto.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: agora + 12 * 3600,
        sub: env.VAPID_SUB || 'https://tolisa.com.br',
      }),
    ),
  );
  const chave = await chavePrivada(env.VAPID_PRIVATE);
  // o WebCrypto já devolve r||s (64 bytes), que é o formato do JWS
  const assinatura = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    chave,
    texto.encode(`${cabeca}.${corpo}`),
  );
  return `${cabeca}.${corpo}.${b64url(assinatura)}`;
}

/**
 * Manda um push vazio. Devolve o status HTTP do serviço de push (201 é entregue; 404/410 a inscrição morreu).
 * @param {string} endpoint
 * @param {{ VAPID_PRIVATE: string, VAPID_PUBLIC: string, VAPID_SUB?: string }} env
 */
export async function empurra(endpoint, env) {
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      TTL: String(24 * 3600),
      Urgency: 'normal',
      'Content-Length': '0',
      Authorization: `vapid t=${await jwt(endpoint, env)}, k=${env.VAPID_PUBLIC}`,
    },
  });
  return r.status;
}
