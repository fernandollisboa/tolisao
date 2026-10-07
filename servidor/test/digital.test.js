// entrar com a digital (#168): uma passkey de mentira feita com o WebCrypto, que assina como o celular assinaria
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import api from '../src/index.js';
import { b64, deB64, derPraCru, limpaEventos } from '../src/digital.js';

const ORIGEM = 'https://tolisa.com.br';

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
      m.set(k, { v, ttl: o.expirationTtl });
    },
    async delete(k) {
      m.delete(k);
    },
    async list({ prefix }) {
      return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
    },
  };
}

let env;
beforeEach(() => {
  env = { KV: kvFalso(), FIREBASE_DB: 'https://banco.exemplo.com', DIGITAL_ORIGENS: `${ORIGEM}, http://localhost:8000` };
});

const pede = async (caminho, corpo, origem = ORIGEM) => {
  const r = await api.fetch(
    new Request(`https://api.exemplo.com${caminho}`, {
      method: 'POST',
      headers: { Origin: origem },
      body: JSON.stringify(corpo),
    }),
    env,
  );
  return { status: r.status, corpo: await r.json() };
};
const desafio = async () => (await pede('/digital/desafio', {})).corpo.desafio;

/** r||s (o que o WebCrypto devolve) → DER (o que o autenticador manda) */
function cruPraDer(cru) {
  const inteiro = (v) => {
    let i = 0;
    while (i < v.length - 1 && v[i] === 0) i++;
    v = v.subarray(i);
    if (v[0] & 0x80) v = Uint8Array.from([0, ...v]);
    return [0x02, v.length, ...v];
  };
  const corpo = [...inteiro(cru.subarray(0, 32)), ...inteiro(cru.subarray(32))];
  return Uint8Array.from([0x30, corpo.length, ...corpo]);
}

const sha = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

/** um celular com digital: cria a passkey e assina, com o que der pra estragar de propósito */
async function celular() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const id = b64(crypto.getRandomValues(new Uint8Array(16)));
  let contador = 0;
  const autenticador = async ({ rpId = 'tolisa.com.br', presente = true, conta = contador } = {}) => {
    const a = new Uint8Array(37);
    a.set(await sha(rpId));
    a[32] = (presente ? 0x01 : 0) | 0x04;
    new DataView(a.buffer).setUint32(33, conta);
    return a;
  };
  const dados = (tipo, d, origem = ORIGEM) =>
    new TextEncoder().encode(JSON.stringify({ type: tipo, challenge: d, origin: origem, crossOrigin: false }));
  return {
    id,
    par,
    set contador(n) {
      contador = n;
    },
    /** o que o app manda no "guardar com a digital" da primeira vez */
    async cria(d, o = {}) {
      return {
        id,
        chave: b64(await crypto.subtle.exportKey('spki', par.publicKey)),
        alg: -7,
        dados: b64(dados('webauthn.create', d, o.origem)),
        autenticador: b64(await autenticador(o)),
      };
    },
    /** o que o app manda no "entrar com a digital" */
    async assina(d, o = {}) {
      const cd = dados('webauthn.get', d, o.origem),
        a = await autenticador(o);
      const msg = new Uint8Array([...a, ...new Uint8Array(await crypto.subtle.digest('SHA-256', cd))]);
      const cru = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, par.privateKey, msg));
      return { id, dados: b64(cd), autenticador: b64(a), assinatura: b64(cruPraDer(cru)) };
    },
  };
}

const EVENTOS = [
  { code: 'churras-k7f3q9', me: 'ana' },
  { code: 'praia-x1y2z3', me: null },
];

async function cadastrado() {
  const c = await celular();
  const r = await pede('/digital/guarda', { ...(await c.cria(await desafio())), eventos: EVENTOS });
  assert.equal(r.status, 201);
  return c;
}

test('guardar e entrar: a lista volta com quem sou eu em cada evento', async () => {
  const c = await cadastrado();
  const r = await pede('/digital/entra', await c.assina(await desafio()));
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo.eventos, EVENTOS);
});

test('assinatura de outra chave não entra', async () => {
  const c = await cadastrado(),
    outro = await celular();
  const r = await pede('/digital/entra', { ...(await outro.assina(await desafio())), id: c.id });
  assert.deepEqual(r, { status: 403, corpo: { erro: 'assinatura não bate' } });
});

test('assinatura estragada não entra', async () => {
  const c = await cadastrado();
  const p = await c.assina(await desafio());
  const a = deB64(p.autenticador);
  a[36] = 9; // mexeu no contador depois de assinar
  const r = await pede('/digital/entra', { ...p, autenticador: b64(a) });
  assert.deepEqual(r, { status: 403, corpo: { erro: 'assinatura não bate' } });
});

test('o desafio vale uma vez só', async () => {
  const c = await cadastrado();
  const p = await c.assina(await desafio());
  assert.equal((await pede('/digital/entra', p)).status, 200);
  assert.deepEqual(await pede('/digital/entra', p), { status: 403, corpo: { erro: 'desafio vencido' } });
});

test('desafio inventado ou velho não passa', async () => {
  const c = await cadastrado();
  const inventado = await pede('/digital/entra', await c.assina(b64(new Uint8Array(32))));
  assert.deepEqual(inventado, { status: 403, corpo: { erro: 'desafio vencido' } });
  const d = await desafio();
  await env.KV.put(`desafio:${d}`, String(Date.now() - 6 * 60 * 1000));
  assert.deepEqual(await pede('/digital/entra', await c.assina(d)), { status: 403, corpo: { erro: 'desafio vencido' } });
  // o desafio vem com prazo no KV também
  await desafio();
  assert.ok([...env.KV.m].some(([k, v]) => k.startsWith('desafio:') && v.ttl === 300));
});

test('outra origem não guarda nem entra, e gasta o desafio do mesmo jeito', async () => {
  const c = await celular();
  const d = await desafio();
  const r = await pede('/digital/guarda', { ...(await c.cria(d, { origem: 'https://tolisa.com.br.mal.com' })), eventos: EVENTOS });
  assert.deepEqual(r, { status: 403, corpo: { erro: 'origem estranha' } });
  assert.equal(await env.KV.get(`desafio:${d}`), null);
  const ok = await cadastrado();
  const e = await pede('/digital/entra', await ok.assina(await desafio(), { origem: 'https://mal.com' }));
  assert.deepEqual(e, { status: 403, corpo: { erro: 'origem estranha' } });
});

test('passkey de outro site (rpId) não passa', async () => {
  const c = await celular();
  const r = await pede('/digital/guarda', { ...(await c.cria(await desafio(), { rpId: 'mal.com' })), eventos: EVENTOS });
  assert.deepEqual(r, { status: 403, corpo: { erro: 'rpId estranho' } });
  const ok = await cadastrado();
  const e = await pede('/digital/entra', await ok.assina(await desafio(), { rpId: 'mal.com' }));
  assert.deepEqual(e, { status: 403, corpo: { erro: 'rpId estranho' } });
});

test('no localhost o rpId é localhost', async () => {
  const c = await celular();
  const origem = 'http://localhost:8000';
  const r = await pede(
    '/digital/guarda',
    { ...(await c.cria(await desafio(), { origem, rpId: 'localhost' })), eventos: EVENTOS },
    origem,
  );
  assert.equal(r.status, 201);
});

test('sem a pessoa tocar, não entra', async () => {
  const c = await cadastrado();
  const r = await pede('/digital/entra', await c.assina(await desafio(), { presente: false }));
  assert.deepEqual(r, { status: 403, corpo: { erro: 'ninguém tocou' } });
});

test('o contador só anda pra frente (passkey clonada não entra)', async () => {
  const c = await cadastrado();
  c.contador = 5;
  assert.equal((await pede('/digital/entra', await c.assina(await desafio()))).status, 200);
  assert.deepEqual(await pede('/digital/entra', await c.assina(await desafio(), { conta: 5 })), {
    status: 403,
    corpo: { erro: 'contador voltou' },
  });
  assert.equal((await pede('/digital/entra', await c.assina(await desafio(), { conta: 6 }))).status, 200);
});

test('passkey sincronizada fica no 0 e entra sem gravar', async () => {
  const c = await cadastrado();
  await pede('/digital/entra', await c.assina(await desafio()));
  const antes = env.KV.gravacoes;
  await pede('/digital/entra', await c.assina(await desafio()));
  assert.equal(env.KV.gravacoes - antes, 1); // só o desafio
});

test('guardar de novo junta a lista, e o me novo vence', async () => {
  const c = await cadastrado();
  const r = await pede('/digital/guarda', {
    ...(await c.assina(await desafio())),
    eventos: [
      { code: 'praia-x1y2z3', me: 'bia' },
      { code: 'bar-a1b2c3', me: 'caio' },
    ],
  });
  assert.deepEqual(r, { status: 200, corpo: { eventos: 3 } });
  const e = await pede('/digital/entra', await c.assina(await desafio()));
  assert.deepEqual(e.corpo.eventos, [
    { code: 'churras-k7f3q9', me: 'ana' },
    { code: 'praia-x1y2z3', me: 'bia' },
    { code: 'bar-a1b2c3', me: 'caio' },
  ]);
});

test('não se cadastra por cima de uma passkey que já existe', async () => {
  const c = await cadastrado();
  const r = await pede('/digital/guarda', { ...(await c.cria(await desafio())), eventos: [] });
  assert.equal(r.status, 409);
});

test('digital desconhecida não entra', async () => {
  const c = await celular();
  assert.equal((await pede('/digital/entra', await c.assina(await desafio()))).status, 404);
});

test('pedido torto é recusado', async () => {
  const c = await celular();
  const bom = { ...(await c.cria(await desafio())), eventos: EVENTOS };
  const tortos = [
    { ...bom, eventos: [{ code: 'Maiúscula', me: 'ana' }] },
    { ...bom, eventos: [{ code: 'ok', me: 'Ana!' }] },
    { ...bom, eventos: 'x' },
    { ...bom, eventos: Array.from({ length: 101 }, (_, i) => ({ code: `e${i}`, me: null })) },
    { ...bom, alg: -257 },
    { ...bom, id: '../x' },
    { ...bom, dados: 'não é base64' },
  ];
  for (const t of tortos) assert.equal((await pede('/digital/guarda', t)).status, 400, JSON.stringify(t).slice(0, 80));
  assert.equal([...env.KV.m.keys()].filter((k) => k.startsWith('digital:')).length, 0);
});

test('o DER vira r||s', () => {
  const r = new Uint8Array(32).fill(0x80),
    s = new Uint8Array(32).fill(1);
  s[0] = 0;
  const cru = new Uint8Array([...r, ...s]);
  assert.deepEqual(derPraCru(cruPraDer(cru)), cru);
  assert.equal(derPraCru(new Uint8Array([0x30, 2, 0, 0])), null);
  assert.equal(limpaEventos([{ code: 'a', me: 'b' }, { code: 'a', me: 'c' }]).length, 1);
});
