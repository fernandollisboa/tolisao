// lê as medições da #262 (travar o nome no aparelho vale a pena?) e imprime tabelas em markdown.
//   quem/<sala>/<aparelho>/<pessoa> no Firebase: colisão (dois aparelhos na mesma pessoa) e troca (um aparelho
//     em duas pessoas), por evento. Lê com a conta de serviço (FIREBASE_SA), ou de um JSON exportado do console:
//     node .github/scripts/medidas.mjs quem.json
//   tolisa_medidas no Analytics Engine (a API /conta): escolhas de nome, primeira ou troca, por faixa de tempo
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const { FIREBASE_SA, CF_TOKEN, CF_CONTA } = process.env;
const dias = Math.min(Math.max(parseInt(process.env.DIAS || '30', 10) || 30, 1), 90);
const arquivo = process.argv[2];

/** o token de leitura do Firebase pela conta de serviço (o mesmo jeito do regras.mjs) */
async function tokenFirebase(sa) {
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
  return (await t.json()).access_token;
}

/** quem/ inteiro: do arquivo, ou do banco com a conta de serviço; null se não tem como ler */
async function leQuem() {
  if (arquivo) return JSON.parse(readFileSync(arquivo, 'utf8'));
  const sa = JSON.parse(FIREBASE_SA || 'null');
  if (!sa?.client_email || !sa?.private_key) return null;
  const db = readFileSync('app.js', 'utf8').match(/const DB = '([^']+)'/)?.[1];
  if (!db) throw new Error('não achei o const DB no app.js');
  const r = await fetch(`${db}/quem.json?access_token=${encodeURIComponent(await tokenFirebase(sa))}`);
  if (!r.ok) throw new Error(`quem/: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) || {};
}

const faixa = (ms) => (ms < 6e4 ? '<1min' : ms < 36e5 ? '<1h' : ms < 864e5 ? '<1dia' : '1dia+');
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');

/** os números da #262 a partir do quem/: só conta evento com 2 pessoas ou mais registradas */
export function resumo(quem, desde = 0) {
  let eventos = 0,
    comColisao = 0,
    comTroca = 0,
    aparelhos = 0,
    trocam = 0;
  /** @type {Record<string, number>} */ const trocas = {};
  for (const porAp of Object.values(quem || {})) {
    // o registro velho (antes da janela) fica de fora: cada evento conta pelo que aconteceu nela
    const regs = Object.entries(porAp || {})
      .map(([ap, gente]) => [ap, Object.entries(gente || {}).filter(([, t]) => +t >= desde)])
      .filter(([, g]) => g.length);
    const pessoas = new Set(regs.flatMap(([, g]) => g.map(([p]) => p)));
    if (pessoas.size < 2) continue;
    eventos++;
    aparelhos += regs.length;
    const porPessoa = {};
    let trocou = false;
    for (const [, g] of regs) {
      for (const [p] of g) porPessoa[p] = (porPessoa[p] || 0) + 1;
      if (g.length < 2) continue;
      trocou = true;
      trocam++;
      // cada troca é o tempo entre uma pessoa e a seguinte, no mesmo aparelho
      const ts = g.map(([, t]) => +t).sort((a, b) => a - b);
      for (let i = 1; i < ts.length; i++) trocas[faixa(ts[i] - ts[i - 1])] = (trocas[faixa(ts[i] - ts[i - 1])] || 0) + 1;
    }
    if (Object.values(porPessoa).some((n) => n > 1)) comColisao++;
    if (trocou) comTroca++;
  }
  return { eventos, comColisao, comTroca, aparelhos, trocam, trocas };
}

/** as linhas do Analytics Engine: escolhas por tipo e faixa; null sem token */
async function leConta() {
  if (!CF_TOKEN || !CF_CONTA) return null;
  const sql = `SELECT blob2 AS k, blob3 AS faixa, SUM(_sample_interval) AS n FROM tolisa_medidas
    WHERE timestamp > NOW() - INTERVAL '${dias}' DAY GROUP BY k, faixa ORDER BY k, faixa FORMAT JSON`;
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_CONTA}/analytics_engine/sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_TOKEN}` },
    body: sql,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Analytics Engine: HTTP ${r.status} ${texto.slice(0, 300)}`);
  return JSON.parse(texto).data || [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const desde = Date.now() - dias * 864e5;
  console.log(`## Medições da #262: últimos ${dias} dias\n`);
  const quem = await leQuem().catch((e) => (console.log(`### quem/: erro\n\n${e.message}\n`), undefined));
  if (quem === null) console.log('### quem/\n\nsem FIREBASE_SA (ou passe o JSON exportado do console)\n');
  else if (quem) {
    const r = resumo(quem, desde);
    console.log(`### quem/ (eventos com 2 pessoas ou mais registradas)\n
| eventos | com colisão (2 aparelhos na mesma pessoa) | com troca (1 aparelho em 2 pessoas) | aparelhos | aparelhos que trocaram |
| --- | --- | --- | --- | --- |
| ${r.eventos} | ${r.comColisao} (${pct(r.comColisao, r.eventos)}) | ${r.comTroca} (${pct(r.comTroca, r.eventos)}) | ${r.aparelhos} | ${r.trocam} (${pct(r.trocam, r.aparelhos)}) |
`);
    console.log(`#### trocas por tempo (toque errado é rápido, celular passado é horas depois)\n\n| faixa | trocas |\n| --- | --- |`);
    for (const f of ['<1min', '<1h', '<1dia', '1dia+']) console.log(`| ${f} | ${r.trocas[f] || 0} |`);
    console.log();
  }
  const linhas = await leConta().catch((e) => (console.log(`### /conta: erro\n\n${e.message}\n`), undefined));
  if (linhas === null) console.log('### /conta\n\nsem CLOUDFARE_API_LOGS_TOKEN ou CLOUDFLARE_ACCOUNT_ID\n');
  else if (linhas) {
    console.log(`### /conta (escolhas de nome)\n\n| tipo | faixa desde a escolha anterior | escolhas |\n| --- | --- | --- |`);
    for (const l of linhas) console.log(`| ${l.k} | ${l.faixa} | ${l.n} |`);
    console.log();
  }
}
