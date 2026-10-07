// entrar com a digital (passkey, #168), protótipo. Guarda a lista de eventos do aparelho (código e quem
// sou eu em cada um) atrás de uma passkey: noutro aparelho, ou depois de limpar o navegador, a digital
// devolve a lista. Sem CBOR e sem dependência: no cadastro a chave pública vem do getPublicKey() (SPKI)
// e o attestation é 'none'; na entrada a assinatura ES256 se confere com o WebCrypto.
//
//   POST /digital/desafio {}                                         → { desafio } (base64url, vale uma vez, 5 min)
//   POST /digital/guarda  { id, chave, alg, dados, autenticador, eventos }      → cadastra a passkey nova
//   POST /digital/guarda  { id, dados, autenticador, assinatura, eventos }      → passkey já cadastrada: junta a lista
//   POST /digital/entra   { id, dados, autenticador, assinatura }    → { eventos }
//
// (dados = clientDataJSON, autenticador = authenticatorData, tudo em base64url)
// KV:
//   desafio:<desafio>   o desafio ainda não usado (some sozinho em 5 min)
//   digital:<id>        { chave, contador, eventos: [{ code, me }], em }
//
// TODO(#168, próxima fatia): o `tok` do pix NÃO vem pra cá. Guardar ele no servidor deixa quem invadir
// a API trocar a chave pix de alguém (desvio de pagamento). A ideia é a extensão PRF da passkey: o
// aparelho tira da digital uma chave que só ele sabe, cifra o tok com ela e a API guarda só o cifrado.

const ID = /^[a-z0-9]{1,32}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;
const DESAFIO_MS = 5 * 60 * 1000;
const MAX_EVENTOS = 100;
const ES256 = -7;

/** @param {string} s */
export function deB64(s) {
  if (typeof s !== 'string' || !B64URL.test(s)) return null;
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
/** @param {ArrayBuffer | Uint8Array} b */
export function b64(b) {
  return btoa(String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
/** @param {BufferSource} b */
const sha256 = async (b) => new Uint8Array(await crypto.subtle.digest('SHA-256', b));
const iguais = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** as origens que podem usar a digital: "https://tolisa.com.br" em produção, o localhost nos testes @param {any} env */
const origens = (env) =>
  String(env.DIGITAL_ORIGENS || 'https://tolisa.com.br')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** a assinatura do WebAuthn vem em DER; o WebCrypto quer r||s, 32 bytes cada @param {Uint8Array} der */
export function derPraCru(der) {
  if (der.length < 8 || der[0] !== 0x30 || der[1] !== der.length - 2) return null;
  const cru = new Uint8Array(64);
  let i = 2;
  for (const pos of [0, 32]) {
    if (der[i] !== 0x02) return null;
    const n = der[i + 1];
    let v = der.subarray(i + 2, i + 2 + n);
    if (v.length !== n) return null;
    while (v.length > 32 && v[0] === 0) v = v.subarray(1);
    if (v.length > 32) return null;
    cru.set(v, pos + 32 - v.length);
    i += 2 + n;
  }
  return i === der.length ? cru : null;
}

/** só o que o app precisa: código e quem sou eu, cada um no formato que o app aceita */
export function limpaEventos(lista) {
  if (!Array.isArray(lista) || lista.length > MAX_EVENTOS) return null;
  const vistos = new Set(),
    eventos = [];
  for (const e of lista) {
    if (!e || typeof e.code !== 'string' || !e.code || e.code.length > 100 || e.code !== e.code.trim().toLowerCase())
      return null;
    if (e.me !== null && e.me !== undefined && !(typeof e.me === 'string' && ID.test(e.me))) return null;
    if (vistos.has(e.code)) continue;
    vistos.add(e.code);
    eventos.push({ code: e.code, me: e.me || null });
  }
  return eventos;
}

/** o que vem novo vence (o me pode ter mudado), o que só estava guardado continua */
function junta(velhos, novos) {
  const porCodigo = new Map(velhos.map((e) => [e.code, e]));
  for (const e of novos) porCodigo.set(e.code, { code: e.code, me: e.me || porCodigo.get(e.code)?.me || null });
  return [...porCodigo.values()].slice(-MAX_EVENTOS);
}

/** gasta o desafio: só passa uma vez, e só dentro do prazo @param {any} env @param {string} desafio */
async function gastaDesafio(env, desafio) {
  if (typeof desafio !== 'string' || !B64URL.test(desafio) || desafio.length > 100) return false;
  const chave = `desafio:${desafio}`,
    v = await env.KV.get(chave);
  if (!v) return false;
  await env.KV.delete(chave);
  return Date.now() - Number(v) <= DESAFIO_MS;
}

/**
 * confere o clientDataJSON e o authenticatorData: o tipo, o desafio (gasto aqui), a origem, o hash do rpId
 * e a presença da pessoa. Devolve { dados, auth, contador } ou o motivo da recusa
 * @param {any} b @param {any} env @param {'webauthn.create' | 'webauthn.get'} tipo
 */
async function confere(b, env, tipo) {
  const dados = deB64(b.dados),
    auth = deB64(b.autenticador);
  if (!dados || !auth || auth.length < 37 || dados.length > 2048) return { erro: 'pedido torto' };
  let cd;
  try {
    cd = JSON.parse(new TextDecoder().decode(dados));
  } catch {
    return { erro: 'pedido torto' };
  }
  if (!cd || cd.type !== tipo) return { erro: 'pedido torto' };
  if (!(await gastaDesafio(env, cd.challenge))) return { erro: 'desafio vencido' };
  if (!origens(env).includes(cd.origin)) return { erro: 'origem estranha' };
  // o rpId é o domínio do próprio site: tolisa.com.br em produção, localhost na máquina
  const rpId = new URL(cd.origin).hostname;
  if (!iguais(auth.subarray(0, 32), await sha256(new TextEncoder().encode(rpId)))) return { erro: 'rpId estranho' };
  if (!(auth[32] & 0x01)) return { erro: 'ninguém tocou' };
  const contador = new DataView(auth.buffer, auth.byteOffset).getUint32(33);
  return { dados, auth, contador };
}

/** a assinatura da passkey guardada sobre authenticatorData || sha256(clientDataJSON), e o contador andando */
async function confereAssinatura(b, guardado, c) {
  const der = deB64(b.assinatura),
    cru = der && derPraCru(der),
    spki = deB64(guardado.chave);
  if (!cru || !spki) return 'assinatura torta';
  const chave = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const msg = new Uint8Array(c.auth.length + 32);
  msg.set(c.auth);
  msg.set(await sha256(c.dados), c.auth.length);
  if (!(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, chave, cru, msg))) return 'assinatura não bate';
  // passkey sincronizada (iCloud, Google) manda sempre 0; a que conta tem que contar pra frente (senão é clone)
  if ((c.contador || guardado.contador) && c.contador <= guardado.contador) return 'contador voltou';
  return null;
}

/** @param {any} env */
export async function desafio(b, env, json) {
  const d = b64(crypto.getRandomValues(new Uint8Array(32)));
  await env.KV.put(`desafio:${d}`, String(Date.now()), { expirationTtl: DESAFIO_MS / 1000 });
  return json(200, { desafio: d });
}

/** @param {any} env */
export async function guarda(b, env, json) {
  const eventos = limpaEventos(b.eventos);
  if (typeof b.id !== 'string' || !B64URL.test(b.id) || b.id.length > 200 || !eventos)
    return json(400, { erro: 'pedido torto' });
  const chaveKv = `digital:${b.id}`,
    guardado = JSON.parse((await env.KV.get(chaveKv)) || 'null');
  if (typeof b.chave === 'string') {
    // passkey nova: a chave pública vem do getPublicKey(), em SPKI; só ES256
    const spki = deB64(b.chave);
    if (b.alg !== ES256 || !spki || spki.length > 200) return json(400, { erro: 'pedido torto' });
    const c = await confere(b, env, 'webauthn.create');
    if (c.erro) return json(c.erro === 'pedido torto' ? 400 : 403, { erro: c.erro });
    if (guardado) return json(409, { erro: 'já tem' });
    try {
      await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    } catch {
      return json(400, { erro: 'chave torta' });
    }
    await env.KV.put(chaveKv, JSON.stringify({ chave: b.chave, contador: c.contador, eventos, em: Date.now() }));
    return json(201, { eventos: eventos.length });
  }
  // passkey que já tem lista: assina de novo e a lista nova se junta à guardada
  const c = await confere(b, env, 'webauthn.get');
  if (c.erro) return json(c.erro === 'pedido torto' ? 400 : 403, { erro: c.erro });
  if (!guardado) return json(404, { erro: 'não conheço essa digital' });
  const recusa = await confereAssinatura(b, guardado, c);
  if (recusa) return json(403, { erro: recusa });
  const todos = junta(guardado.eventos, eventos);
  await env.KV.put(chaveKv, JSON.stringify({ ...guardado, contador: c.contador, eventos: todos, em: Date.now() }));
  return json(200, { eventos: todos.length });
}

/** @param {any} env */
export async function entra(b, env, json) {
  if (typeof b.id !== 'string' || !B64URL.test(b.id) || b.id.length > 200) return json(400, { erro: 'pedido torto' });
  const c = await confere(b, env, 'webauthn.get');
  if (c.erro) return json(c.erro === 'pedido torto' ? 400 : 403, { erro: c.erro });
  const chaveKv = `digital:${b.id}`,
    guardado = JSON.parse((await env.KV.get(chaveKv)) || 'null');
  if (!guardado) return json(404, { erro: 'não conheço essa digital' });
  const recusa = await confereAssinatura(b, guardado, c);
  if (recusa) return json(403, { erro: recusa });
  // só grava se o contador andou: o KV grátis conta gravação, e passkey sincronizada fica no 0
  if (c.contador !== guardado.contador) await env.KV.put(chaveKv, JSON.stringify({ ...guardado, contador: c.contador }));
  return json(200, { eventos: guardado.eventos });
}
