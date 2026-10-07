// a API do tô lisa: aviso no celular quando alguém marca que te pagou (#89).
// Worker da Cloudflare, só API web padrão, nenhuma dependência em produção.
//
//   GET  /chave                                → a chave pública VAPID (base64url), pro pushManager.subscribe
//   POST /inscreve   {sala, pessoa, sub, tok}  → guarda a inscrição de push desse aparelho
//   POST /desinscreve {sala, pessoa, endpoint, tok}
//   POST /avisa      {sala, id}                → relê a sala no Firebase e avisa quem recebeu (ou quem foi perdoado)
//   POST /digital/…                             → entrar com a digital (passkey, #168): ver digital.js
//
// O corpo nunca é confiável além dos ids: o /avisa lê o pagamento do próprio banco.
// O banco (KV) é contado: o plano grátis dá 1000 gravações por dia, então só se grava o necessário.
//   sub:<sala>:<pessoa>:<hash do endpoint>  a inscrição (JSON); o endpoint vai também no metadata, pro list bastar
//   tok:<sala>:<pessoa>                     sha-256 do tok: quem inscreveu primeiro manda (igual ao tok do pix)
//   avisado:<sala>:<id>                     esse pagamento já avisou (some sozinho em 1 dia)

import { empurra } from './vapid.js';
import * as digital from './digital.js';

const SALA = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9]{1,32}$/;
const TOK = /^[a-z0-9]{16,64}$/;
const MAX_CORPO = 4096;
const MAX_CORPO_DIGITAL = 16384; // a lista de eventos (até 100) e o que a passkey assinou
const MAX_POR_PESSOA = 5;
const JANELA_MS = 10 * 60 * 1000;

/** @typedef {{ get(k: string): Promise<string|null>, put(k: string, v: string, o?: { expirationTtl?: number, metadata?: any }): Promise<void>, delete(k: string): Promise<void>, list(o: { prefix: string, cursor?: string }): Promise<{ keys: { name: string, metadata?: any }[], list_complete: boolean, cursor?: string }> }} KV */
/** @typedef {{ KV: KV, FIREBASE_DB: string, VAPID_PUBLIC: string, VAPID_PRIVATE: string, VAPID_SUB?: string, DIGITAL_ORIGENS?: string }} Env */

/** @param {string | null} origem */
export function origemOk(origem) {
  return (
    origem === 'https://tolisa.com.br' || (!!origem && /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origem))
  );
}

/** @param {string | null} origem */
function cors(origem) {
  if (!origemOk(origem)) return {};
  return {
    'Access-Control-Allow-Origin': /** @type {string} */ (origem),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** @param {number} status @param {any} corpo @param {string | null} origem */
function json(status, corpo, origem) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origem) },
  });
}

/** @param {string} s */
async function sha256(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** @param {Request} req */
async function corpo(req, max = MAX_CORPO) {
  const t = await req.text();
  if (t.length > max) return null;
  try {
    const o = JSON.parse(t);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

/** a PushSubscription como o navegador manda: só o que serve, e só https */
function limpaSub(s) {
  if (!s || typeof s !== 'object' || typeof s.endpoint !== 'string' || s.endpoint.length > 800) return null;
  let u;
  try {
    u = new URL(s.endpoint);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const k = s.keys;
  const b64 = /^[A-Za-z0-9_-]{1,200}={0,2}$/;
  if (!k || typeof k.p256dh !== 'string' || typeof k.auth !== 'string' || !b64.test(k.p256dh) || !b64.test(k.auth))
    return null;
  return { endpoint: s.endpoint, keys: { p256dh: k.p256dh, auth: k.auth } };
}

/** @param {KV} kv @param {string} prefixo */
async function lista(kv, prefixo) {
  const todas = [];
  let cursor;
  do {
    const r = await kv.list({ prefix: prefixo, cursor });
    todas.push(...r.keys);
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return todas;
}

/** confere o tok de (sala, pessoa); `grava` guarda o primeiro. Devolve false se o tok não bate. */
async function confereTok(env, sala, pessoa, tok, grava) {
  const chave = `tok:${sala}:${pessoa}`;
  const h = await sha256(tok);
  const guardado = await env.KV.get(chave);
  if (guardado) return guardado === h;
  if (!grava) return false;
  await env.KV.put(chave, h);
  return true;
}

/** @param {any} b @param {Env} env @param {string | null} o */
async function inscreve(b, env, o) {
  const sub = limpaSub(b.sub);
  if (!SALA.test(b.sala) || !ID.test(b.pessoa) || !TOK.test(b.tok) || !sub)
    return json(400, { erro: 'pedido torto' }, o);
  if (!(await confereTok(env, b.sala, b.pessoa, b.tok, true))) return json(403, { erro: 'tok não bate' }, o);
  const prefixo = `sub:${b.sala}:${b.pessoa}:`;
  const chave = prefixo + (await sha256(sub.endpoint)).slice(0, 32);
  const valor = JSON.stringify(sub);
  if ((await env.KV.get(chave)) === valor) return json(200, { ok: true }, o); // já tá: não gasta gravação
  const outras = (await lista(env.KV, prefixo)).filter((k) => k.name !== chave);
  // passou do teto: sai a mais velha
  outras.sort((a, b) => (a.metadata?.em || 0) - (b.metadata?.em || 0));
  for (const k of outras.slice(0, Math.max(0, outras.length - MAX_POR_PESSOA + 1))) await env.KV.delete(k.name);
  await env.KV.put(chave, valor, { metadata: { endpoint: sub.endpoint, em: Date.now() } });
  return json(201, { ok: true }, o);
}

/** @param {any} b @param {Env} env @param {string | null} o */
async function desinscreve(b, env, o) {
  if (
    !SALA.test(b.sala) ||
    !ID.test(b.pessoa) ||
    !TOK.test(b.tok) ||
    typeof b.endpoint !== 'string' ||
    b.endpoint.length > 800
  )
    return json(400, { erro: 'pedido torto' }, o);
  if (!(await confereTok(env, b.sala, b.pessoa, b.tok, false))) return json(403, { erro: 'tok não bate' }, o);
  await env.KV.delete(`sub:${b.sala}:${b.pessoa}:${(await sha256(b.endpoint)).slice(0, 32)}`);
  return json(200, { ok: true }, o);
}

/** a lista do Firebase vem como array ou como objeto de índices */
const valores = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : []).filter(Boolean);

/** @param {any} b @param {Env} env @param {string | null} o */
async function avisa(b, env, o) {
  if (!SALA.test(b.sala) || !ID.test(b.id)) return json(400, { erro: 'pedido torto' }, o);
  const r = await fetch(`${env.FIREBASE_DB}/rooms/${b.sala}.json`, { cache: 'no-store' });
  if (!r.ok) return json(502, { erro: 'banco fora' }, o);
  const sala = await r.json().catch(() => null);
  const e = valores(sala?.expenses).find((x) => x.id === b.id);
  const agora = Date.now();
  if (!e || e.kind !== 'payment' || typeof e.at !== 'number' || agora - e.at > JANELA_MS || e.at - agora > 60000)
    return json(404, { erro: 'pagamento não achado' }, o);
  // o perdão avisa quem devia; o pagamento avisa quem recebe
  const alvo = e.forgiven === true ? e.payer : valores(e.among)[0];
  if (typeof alvo !== 'string' || !ID.test(alvo)) return json(404, { erro: 'pagamento não achado' }, o);
  // quem marcou não precisa ser avisado do que ele mesmo marcou
  const nome = valores(sala.people).find((p) => p.id === alvo)?.name;
  if (nome && e.by === nome) return json(200, { avisados: 0 }, o);
  const subs = await lista(env.KV, `sub:${b.sala}:${alvo}:`);
  if (!subs.length) return json(200, { avisados: 0 }, o);
  const marca = `avisado:${b.sala}:${b.id}`;
  if (await env.KV.get(marca)) return json(200, { avisados: 0, repetido: true }, o);
  await env.KV.put(marca, '1', { expirationTtl: 86400 });
  let avisados = 0;
  for (const k of subs) {
    const endpoint = k.metadata?.endpoint || JSON.parse((await env.KV.get(k.name)) || '{}').endpoint;
    if (!endpoint) continue;
    const st = await empurra(endpoint, env).catch(() => 0);
    if (st === 404 || st === 410) await env.KV.delete(k.name);
    else if (st >= 200 && st < 300) avisados++;
  }
  return json(200, { avisados }, o);
}

export default {
  /** @param {Request} req @param {Env} env */
  async fetch(req, env) {
    const o = req.headers.get('Origin');
    // navegador de outro site: nem responde. sem Origin (curl, smoke test) passa: CORS não é segurança
    if (o && !origemOk(o)) return new Response(null, { status: 403 });
    const { pathname } = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(o) });
    if (req.method === 'GET' && pathname === '/chave') {
      if (!env.VAPID_PUBLIC) return json(503, { erro: 'sem chave ainda' }, o);
      return json(200, { chave: env.VAPID_PUBLIC }, o);
    }
    const rota = {
      '/inscreve': inscreve,
      '/desinscreve': desinscreve,
      '/avisa': avisa,
      '/digital/desafio': (b, env, o) => digital.desafio(b, env, (s, c) => json(s, c, o)),
      '/digital/guarda': (b, env, o) => digital.guarda(b, env, (s, c) => json(s, c, o)),
      '/digital/entra': (b, env, o) => digital.entra(b, env, (s, c) => json(s, c, o)),
    }[pathname];
    if (!rota) return json(404, { erro: 'não tem' }, o);
    if (req.method !== 'POST') return json(405, { erro: 'só POST' }, o);
    const b = await corpo(req, pathname.startsWith('/digital/') ? MAX_CORPO_DIGITAL : MAX_CORPO);
    if (!b) return json(400, { erro: 'pedido torto' }, o);
    try {
      return await rota(b, env, o);
    } catch (err) {
      console.error(err);
      return json(500, { erro: 'deu ruim' }, o);
    }
  },
};
