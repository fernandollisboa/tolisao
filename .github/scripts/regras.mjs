// publica o database.rules.json no Firebase com a conta de serviço (secret FIREBASE_SA) e confere
// que o que ficou lá é o mesmo do arquivo. O banco sai da linha `const DB` do app.js
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const sa = JSON.parse(process.env.FIREBASE_SA || 'null');
if (!sa?.client_email || !sa?.private_key) throw new Error('falta o secret FIREBASE_SA (JSON da conta de serviço)');
const db = readFileSync('app.js', 'utf8').match(/const DB = '([^']+)'/)?.[1];
if (!db) throw new Error('não achei o const DB no app.js');
const regras = readFileSync('database.rules.json', 'utf8');
const esperado = JSON.parse(regras);

const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const corpo =
  b64({ alg: 'RS256', typ: 'JWT' }) +
  '.' +
  b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 600,
  });
const jwt = corpo + '.' + createSign('RSA-SHA256').update(corpo).sign(sa.private_key, 'base64url');
const t = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
});
if (!t.ok) throw new Error(`token: HTTP ${t.status} ${await t.text()}`);
const { access_token } = await t.json();

const url = `${db}/.settings/rules.json?access_token=${encodeURIComponent(access_token)}`;
const put = await fetch(url, { method: 'PUT', body: regras });
if (!put.ok) throw new Error(`publicar: HTTP ${put.status} ${await put.text()}`);
const lido = await (await fetch(url)).json();
const ordena = (v) =>
  Array.isArray(v) ? v.map(ordena) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordena(v[k])])) : v;
if (JSON.stringify(ordena(lido)) !== JSON.stringify(ordena(esperado))) throw new Error('as regras no Firebase não batem com o arquivo');
console.log(`regras publicadas em ${db}`);
