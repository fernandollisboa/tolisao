// lê o Web Analytics (RUM) da conta pela API GraphQL da Cloudflare e imprime tabelas em markdown.
const { CF_TOKEN, CF_CONTA } = process.env;
const dias = Math.min(Math.max(parseInt(process.env.DIAS || '7', 10) || 7, 1), 90);
if (!CF_TOKEN || !CF_CONTA) {
  console.log('faltou secret: CLOUDFARE_API_LOGS_TOKEN ou CLOUDFLARE_ACCOUNT_ID');
  process.exit(1);
}
const desde = new Date(Date.now() - dias * 864e5).toISOString();
const quebra = (nome, dims) => `
  ${nome}: rumPageloadEventsAdaptiveGroups(limit: 50, filter: $f, orderBy: [count_DESC]) {
    count sum { visits } dimensions { ${dims} }
  }`;
const query = `query ($conta: String!, $f: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {
  viewer { accounts(filter: { accountTag: $conta }) {
    ${quebra('dia', 'date')}
    ${quebra('host', 'requestHost')}
    ${quebra('pagina', 'requestHost requestPath')}
    ${quebra('origem', 'refererHost')}
    ${quebra('pais', 'countryName')}
    ${quebra('aparelho', 'deviceType')}
  } }
}`;
const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
  method: 'POST',
  headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, variables: { conta: CF_CONTA, f: { datetime_geq: desde } } }),
});
const j = await r.json().catch(() => ({}));
if (!r.ok || j.errors?.length) {
  console.log(`### erro da API (HTTP ${r.status})\n\n${(j.errors || []).map((e) => `- ${e.message}`).join('\n')}`);
  process.exit(1);
}
const conta = j.data.viewer.accounts[0];
if (!conta) {
  console.log('### a conta não voltou (CLOUDFLARE_ACCOUNT_ID errado ou token sem acesso)');
  process.exit(1);
}
console.log(`## Web Analytics: últimos ${dias} dias (desde ${desde.slice(0, 10)})\n`);
for (const [nome, linhas] of Object.entries(conta)) {
  if (nome === 'dia') linhas.sort((a, b) => a.dimensions.date.localeCompare(b.dimensions.date));
  const cols = Object.keys(linhas[0]?.dimensions || { [nome]: 0 });
  console.log(`### ${nome}\n\n| ${cols.join(' | ')} | views | visitas |\n|${' --- |'.repeat(cols.length + 2)}`);
  for (const l of linhas) console.log(`| ${cols.map((c) => l.dimensions[c] || '—').join(' | ')} | ${l.count} | ${l.sum.visits} |`);
  console.log();
}
