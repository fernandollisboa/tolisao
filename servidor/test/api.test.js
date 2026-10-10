// a API com KV de mentira e fetch de mentira (Firebase e serviço de push). roda com `node --test`.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import api, { saldo } from '../src/index.js';
import { jwt, b64url, deB64url } from '../src/vapid.js';

const SALA = 'a'.repeat(64);
const ORIGEM = 'https://tolisa.com.br';
const PUSH = 'https://push.exemplo.com/envio/';

/** KV em memória, com o mesmo jeitão do da Cloudflare (e contando as gravações) */
function kvFalso() {
  const m = new Map();
  return {
    m,
    gravacoes: 0,
    async get(k) {
      return m.has(k) ? m.get(k).v : null;
    },
    async put(k, v, o = {}) {
      this.gravacoes++;
      m.set(k, { v, metadata: o.metadata, ttl: o.expirationTtl });
    },
    async delete(k) {
      m.delete(k);
    },
    async list({ prefix }) {
      const keys = [...m].filter(([k]) => k.startsWith(prefix)).map(([name, { metadata }]) => ({ name, metadata }));
      return { keys, list_complete: true };
    },
  };
}

let env, sala, enviados, lidas, statusPush, fetchOriginal;

beforeEach(async () => {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const { kty, crv, x, y, d } = await crypto.subtle.exportKey('jwk', par.privateKey);
  env = {
    KV: kvFalso(),
    FIREBASE_DB: 'https://banco.exemplo.com',
    VAPID_PRIVATE: JSON.stringify({ kty, crv, x, y, d }),
    VAPID_PUBLIC: b64url(await crypto.subtle.exportKey('raw', par.publicKey)),
  };
  const agora = Date.now();
  sala = {
    people: [
      { id: 'ana', name: 'Ana' },
      { id: 'bia', name: 'Bia' },
    ],
    expenses: [
      { id: 'pg1', kind: 'payment', amount: 10, payer: 'bia', among: ['ana'], at: agora - 1000, by: 'Bia' },
      {
        id: 'pd1',
        kind: 'payment',
        forgiven: true,
        amount: 5,
        payer: 'bia',
        among: ['ana'],
        at: agora - 1000,
        by: 'Ana',
      },
      { id: 'velho', kind: 'payment', amount: 5, payer: 'bia', among: ['ana'], at: agora - 11 * 60 * 1000, by: 'Bia' },
      { id: 'rc1', kind: 'payment', amount: 5, payer: 'bia', among: ['ana'], at: agora - 1000, by: 'Ana' },
      { id: 'gasto', amount: 30, payer: 'ana', among: ['ana', 'bia'], at: agora - 1000 },
    ],
  };
  enviados = [];
  lidas = 0;
  statusPush = 201;
  fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith(`${env.FIREBASE_DB}/rooms/`)) {
      lidas++;
      return Response.json(sala);
    }
    if (u.startsWith(PUSH)) {
      enviados.push({ url: u, headers: init.headers, body: init.body });
      return new Response(null, { status: statusPush });
    }
    throw new Error(`fetch inesperado: ${u}`);
  };
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

const pede = (caminho, { metodo = 'POST', corpo, origem = ORIGEM } = {}) =>
  api.fetch(
    new Request(`https://api.exemplo.com${caminho}`, {
      method: metodo,
      headers: { ...(origem ? { Origin: origem } : {}), 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
    }),
    env,
  );

const sub = (n = 1) => ({ endpoint: `${PUSH}${n}`, keys: { p256dh: 'BOa_-1', auth: 'xyz' } });
const TOK = 'tokdaana12345678';
const inscreve = (pessoa = 'ana', s = sub(), tok = TOK) =>
  pede('/inscreve', { corpo: { sala: SALA, pessoa, sub: s, tok } });

test('CORS: o site e o localhost passam, outro site não', async () => {
  const r = await pede('/chave', { metodo: 'GET' });
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGEM);
  const local = await pede('/chave', { metodo: 'OPTIONS', origem: 'http://localhost:8000' });
  assert.equal(local.status, 204);
  assert.equal(local.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8000');
  assert.match(local.headers.get('Access-Control-Allow-Methods'), /POST/);
  for (const o of [
    'https://tolisa.com.br.mal.com',
    'http://tolisa.com.br',
    'https://mal.com',
    'http://localhost.mal.com',
  ]) {
    const ruim = await pede('/chave', { metodo: 'GET', origem: o });
    assert.equal(ruim.status, 403, o);
    assert.equal(ruim.headers.get('Access-Control-Allow-Origin'), null);
  }
});

test('/chave devolve a pública, mesmo sem Origin', async () => {
  const r = await pede('/chave', { metodo: 'GET', origem: null });
  assert.deepEqual(await r.json(), { chave: env.VAPID_PUBLIC });
});

test('pedido torto é recusado', async () => {
  const tortos = [
    'não é json',
    '[]',
    { sala: 'curta', pessoa: 'ana', sub: sub(), tok: TOK },
    { sala: SALA, pessoa: 'Ana!', sub: sub(), tok: TOK },
    { sala: SALA, pessoa: 'ana', sub: sub(), tok: 'curto' },
    { sala: SALA, pessoa: 'ana', sub: { endpoint: 'http://push.exemplo.com/x', keys: sub().keys }, tok: TOK },
    { sala: SALA, pessoa: 'ana', sub: { endpoint: `${PUSH}1` }, tok: TOK },
    JSON.stringify({ sala: SALA, lixo: 'x'.repeat(5000) }),
  ];
  for (const corpo of tortos) assert.equal((await pede('/inscreve', { corpo })).status, 400, JSON.stringify(corpo));
  assert.equal((await pede('/avisa', { corpo: { sala: SALA, id: '../x' } })).status, 400);
  assert.equal((await pede('/inscreve', { metodo: 'GET' })).status, 405);
  assert.equal((await pede('/nada', { corpo: {} })).status, 404);
  assert.equal(env.KV.m.size, 0);
});

test('inscreve: o primeiro tok manda, outro tok é recusado', async () => {
  assert.equal((await inscreve()).status, 201);
  assert.equal((await inscreve('ana', sub(2))).status, 201);
  assert.equal((await inscreve('ana', sub(3), 'outrotok12345678')).status, 403);
  const chaves = [...env.KV.m.keys()];
  assert.equal(chaves.filter((k) => k.startsWith(`sub:${SALA}:ana:`)).length, 2);
  // o tok não fica guardado cru
  assert.ok(![...env.KV.m.values()].some((x) => x.v.includes(TOK)));
});

test('inscreve de novo o mesmo aparelho não grava outra vez', async () => {
  await inscreve();
  const antes = env.KV.gravacoes;
  assert.equal((await inscreve()).status, 200);
  assert.equal(env.KV.gravacoes, antes);
});

test('cada pessoa tem no máximo 5 aparelhos: sai o mais velho', async () => {
  for (let i = 1; i <= 7; i++) await inscreve('ana', sub(i));
  const subs = (await env.KV.list({ prefix: `sub:${SALA}:ana:` })).keys.map((k) => k.metadata.endpoint);
  assert.equal(subs.length, 5);
  assert.ok(subs.includes(`${PUSH}7`));
});

test('desinscreve precisa do tok', async () => {
  await inscreve();
  const corpo = { sala: SALA, pessoa: 'ana', endpoint: `${PUSH}1`, tok: 'outrotok12345678' };
  assert.equal((await pede('/desinscreve', { corpo })).status, 403);
  assert.equal((await pede('/desinscreve', { corpo: { ...corpo, tok: TOK } })).status, 200);
  assert.equal((await env.KV.list({ prefix: `sub:${SALA}:ana:` })).keys.length, 0);
});

test('avisa quem recebeu, uma vez só', async () => {
  await inscreve('ana');
  await inscreve('bia', sub(9), 'tokdabia12345678');
  const r = await pede('/avisa', { corpo: { sala: SALA, id: 'pg1' } });
  assert.deepEqual(await r.json(), { avisados: 1 });
  assert.deepEqual(
    enviados.map((e) => e.url),
    [`${PUSH}1`],
  );
  const h = enviados[0].headers;
  assert.equal(h['Content-Length'], '0');
  assert.ok(+h.TTL > 0);
  assert.match(h.Authorization, new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${env.VAPID_PUBLIC}$`));
  assert.equal(enviados[0].body, undefined);
  // de novo: já avisou
  const r2 = await pede('/avisa', { corpo: { sala: SALA, id: 'pg1' } });
  assert.equal((await r2.json()).avisados, 0);
  assert.equal(enviados.length, 1);
  assert.equal(env.KV.m.get(`avisado:${SALA}:pg1`).ttl, 86400);
});

test('perdão avisa quem devia, não quem perdoou', async () => {
  await inscreve('ana');
  await inscreve('bia', sub(9), 'tokdabia12345678');
  await pede('/avisa', { corpo: { sala: SALA, id: 'pd1' } });
  assert.deepEqual(
    enviados.map((e) => e.url),
    [`${PUSH}9`],
  );
});

test('quem marcou que recebeu não é avisado do próprio clique', async () => {
  await inscreve('ana');
  const r = await pede('/avisa', { corpo: { sala: SALA, id: 'rc1' } });
  assert.equal((await r.json()).avisados, 0);
  assert.equal(enviados.length, 0);
});

test('não avisa gasto comum, pagamento velho nem id que não existe', async () => {
  await inscreve('ana');
  for (const id of ['gasto', 'velho', 'naoexiste'])
    assert.equal((await pede('/avisa', { corpo: { sala: SALA, id } })).status, 404, id);
  assert.equal(enviados.length, 0);
});

test('sem ninguém inscrito, o aviso não gasta gravação', async () => {
  const r = await pede('/avisa', { corpo: { sala: SALA, id: 'pg1' } });
  assert.equal((await r.json()).avisados, 0);
  assert.equal(env.KV.gravacoes, 0);
});

test('inscrição que morreu (410) sai do banco', async () => {
  await inscreve('ana');
  statusPush = 410;
  await pede('/avisa', { corpo: { sala: SALA, id: 'pg1' } });
  assert.equal((await env.KV.list({ prefix: `sub:${SALA}:ana:` })).keys.length, 0);
});

test('o JWT é ES256 e confere com a chave pública', async () => {
  const agora = 1_800_000_000;
  const t = await jwt('https://fcm.googleapis.com/fcm/send/abc', env, agora);
  const [c, p, s] = t.split('.');
  const dec = (x) => JSON.parse(new TextDecoder().decode(deB64url(x)));
  assert.deepEqual(dec(c), { typ: 'JWT', alg: 'ES256' });
  assert.deepEqual(dec(p), { aud: 'https://fcm.googleapis.com', exp: agora + 12 * 3600, sub: 'https://tolisa.com.br' });
  const pub = await crypto.subtle.importKey(
    'raw',
    deB64url(env.VAPID_PUBLIC),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  assert.equal(deB64url(s).length, 64);
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    pub,
    deB64url(s),
    new TextEncoder().encode(`${c}.${p}`),
  );
  assert.ok(ok);
});

// ---------- a diva cobra sozinha (o cron) ----------
const DIA = 86400 * 1000;
/** a Ana pagou 30 dividido com a Bia, e ninguém mexe no evento há `dias` dias */
const parada = (dias = 8) => ({
  name: 'churras',
  updatedAt: Date.now() - dias * DIA,
  people: [
    { id: 'ana', name: 'Ana' },
    { id: 'bia', name: 'Bia' },
  ],
  expenses: [{ id: 'g1', amount: 30, payer: 'ana', among: ['ana', 'bia'], at: Date.now() - dias * DIA }],
});
/** roda o cron como a Cloudflare roda: o trabalho vem pelo waitUntil */
const cron = () => new Promise((ok) => api.scheduled({}, env, { waitUntil: ok }));

test('evento parado: a diva cobra quem tem a receber, e só ele', async () => {
  sala = parada();
  await inscreve('ana');
  await inscreve('bia', sub(9), 'tokdabia12345678');
  assert.equal(await cron(), 1);
  assert.deepEqual(
    enviados.map((e) => e.url),
    [`${PUSH}1`],
  );
  assert.equal(env.KV.m.get(`lembrou:${SALA}:ana`).ttl, 7 * 86400);
  assert.equal(env.KV.m.has(`lembrou:${SALA}:bia`), false);
});

test('quem já foi lembrado na semana não é cobrado de novo', async () => {
  sala = parada();
  await inscreve('ana');
  await cron();
  const antes = env.KV.gravacoes;
  assert.equal(await cron(), 0);
  assert.equal(enviados.length, 1);
  assert.equal(env.KV.gravacoes, antes);
});

test('evento mexido na semana não cobra nem grava nada', async () => {
  sala = parada(6);
  await inscreve('ana');
  const antes = env.KV.gravacoes;
  assert.equal(await cron(), 0);
  assert.equal(enviados.length, 0);
  assert.equal(env.KV.gravacoes, antes);
});

test('a cobrança cabe nos 50 fetch do plano grátis', async () => {
  sala = parada();
  for (let i = 0; i < 40; i++)
    for (const n of [i, 100 + i])
      await pede('/inscreve', {
        corpo: { sala: i.toString(16).padStart(64, '0'), pessoa: 'ana', sub: sub(n), tok: TOK },
      });
  assert.ok((await cron()) > 0);
  assert.ok(lidas + enviados.length <= 50, `${lidas} leituras + ${enviados.length} pushes`);
});

test('o saldo é a conta do app: partes que fecham, centavo que sobra, item apagado fora', () => {
  const s = {
    people: [{ id: 'ana' }, { id: 'bia' }, { id: 'caio' }],
    deleted: ['x'],
    expenses: [
      { id: 'a', amount: 10, payer: 'ana', among: ['ana', 'bia', 'caio'] },
      { id: 'b', amount: 10, payer: 'bia', among: { 0: 'ana', 1: 'bia' }, shares: { ana: 700, bia: 300 } },
      { id: 'c', amount: 10, payer: 'bia', among: ['ana', 'bia'], shares: { ana: 1, bia: 1 } },
      { id: 'x', amount: 99, payer: 'caio', among: ['ana'] },
      { id: 'd', amount: 5, payer: 'ana', among: ['fantasma'] },
    ],
  };
  // a: 3,34 da Ana (o centavo que sobra), 3,33 dos outros; b: as partes; c: partes que não fecham dividem igual
  assert.equal(saldo(s, 'ana'), 1000 - 334 - 700 - 500);
  assert.equal(saldo(s, 'bia'), -333 + 1000 - 300 + 1000 - 500);
  assert.equal(saldo(s, 'caio'), -333);
});
