// as regras do CLAUDE.md que dá pra conferir lendo arquivo, sem navegador.
// `npm run regras` roda no CI antes dos testes: é o que a IA (ou a gente) esquece
// e nenhum cenário pega, porque validação de banco não vira cenário.
// Cada regra é sim ou não: nada de limite que alguém sobe pra passar.
const fs = require('fs'), path = require('path');

const raiz = path.join(__dirname, '..');
const le = f => fs.readFileSync(path.join(raiz, f), 'utf8');
const html = le('index.html'), app = le('app.js'), banco = JSON.parse(le('database.rules.json'));
const falhas = [];
const regra = (nome, erro) => { if (erro) falhas.push(`✗ ${nome}\n    ${erro}`); else console.log(`✓ ${nome}`); };

// ---------- CSP: script só do próprio site, conexão só com o firebase e a API do aviso ----------
// o hash do <script> do fim não mora aqui: se ele quebrar, todo cenário falha (_mundo.cjs)
{
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1] || '';
  const dir = Object.fromEntries(csp.split(';').map(d => d.trim().split(/\s+/)).filter(d => d[0]).map(([k, ...v]) => [k, v]));
  const pode = { 'default-src': ["'self'"], 'script-src': ["'self'", /^'sha256-/], 'connect-src': ["'self'", 'https://*.firebaseio.com', 'https://tolisa-api.fernando-costa-fd0.workers.dev'] };
  const errados = Object.entries(pode).flatMap(([k, ok]) => !dir[k] ? [`falta ${k}`]
    : dir[k].filter(v => !ok.some(o => typeof o === 'string' ? o === v : o.test(v))).map(v => `${k} ${v}`));
  regra('a CSP só roda script do site e só fala com o firebase e a API', !csp ? 'não achei o <meta> da CSP no index.html' : errados.join('; '));
}

// ---------- banco: .read/.write só abaixo de um $curinga ----------
// `.read` em `rooms` faria `GET /rooms.json` baixar o banco inteiro; o mesmo vale pra `pix`
{
  const soltos = [];
  const anda = (no, caminho) => {
    for (const [k, v] of Object.entries(no)) {
      if ((k === '.read' || k === '.write') && v !== false && !caminho.some(c => c.startsWith('$'))) soltos.push(`${caminho.join('/') || 'raiz'} tem ${k}`);
      else if (v && typeof v === 'object') anda(v, [...caminho, k]);
    }
  };
  anda(banco.rules, []);
  regra('o banco não deixa listar salas nem chaves pix', soltos.length && soltos.join('; '));
  // do pix só a chave se lê: quem lê o tok troca a chave pix dos outros
  const lidos = [];
  const pix = (no, caminho) => { for (const [k, v] of Object.entries(no)) {
    if (k === '.read' && v !== false && caminho.at(-1) !== 'key') lidos.push(`pix/${caminho.join('/')} tem .read`);
    else if (v && typeof v === 'object') pix(v, [...caminho, k]); } };
  pix(banco.rules.pix || {}, []);
  regra('o tok do pix não se lê', lidos.join('; '));
  // visitas é só um +1 por dia: ninguém lista, ninguém apaga (.validate não roda em delete), ninguém pula de 1000 em 1000
  const vis = banco.rules.visitas, dia = vis?.$dia || {}, erros = [];
  if (!vis) erros.push('não achei visitas no database.rules.json');
  else {
    if (JSON.stringify(vis).includes('".read"')) erros.push('visitas tem .read');
    if (!/newData\.exists\(\)/.test(dia['.write'] || '')) erros.push('o .write de visitas/$dia não exige newData.exists()');
    if (!(dia['.validate'] || '').includes('data.val() + 1')) erros.push('o .validate de visitas/$dia não exige data.val() + 1');
  }
  regra('visitas só se soma', erros.join('; '));
}

// ---------- clean() e .validate de rooms/$room contam o mesmo ----------
{
  const sala = banco.rules.rooms.$room, pessoa = sala.people.$i, item = sala.expenses.$i;
  const limite = v => +(v['.validate'].match(/length <= (\d+)/)?.[1] ?? NaN);
  const corpo = app.match(/function clean\(d\)\s*\{[\s\S]*?\n {2}\}/)?.[0] || '';
  const pares = [
    ['nome do evento', limite(sala.name), /str\(d\.name, (\d+)\)/],
    ['nome da pessoa', limite(pessoa.name), /str\(p\.name, (\d+)\)/],
    ['descrição do item', limite(item.desc), /str\(e\.desc, (\d+)\)/],
    ['quem anotou', limite(item.by), /str\(e\.by, (\d+)\)/],
  ];
  const errados = pares.map(([nome, banco, re]) => {
    const cod = +(corpo.match(re)?.[1] ?? NaN);
    return cod === banco ? null : `${nome}: banco ${banco}, clean() ${Number.isNaN(cod) ? 'não achei' : cod}`;
  }).filter(Boolean);
  // quantos dividem um gasto: o banco conta pelo índice do among ({1,2} → 100), o app pelo RACHA_MAX
  const digitos = +(item.among.$j['.validate'].match(/\{1,(\d)\}/)?.[1] ?? NaN), racha = +(app.match(/const RACHA_MAX = (\d+)/)?.[1] ?? NaN);
  if (racha !== 10 ** digitos) errados.push(`quantos dividem: banco ${10 ** digitos}, RACHA_MAX ${Number.isNaN(racha) ? 'não achei' : racha}`);
  if (!/among\.length <= RACHA_MAX/.test(corpo)) errados.push('clean() não confere o among com o RACHA_MAX');
  const idApp = app.match(/const okId = [^\n]*?(\/\^\[[^/]+\/)/)?.[1];
  const idsBanco = [...new Set([...JSON.stringify(banco).matchAll(/matches\((\/\^\[a-z[^)]+)\)/g)].map(m => m[1]))];
  if (!idApp) errados.push('não achei o okId no app.js');
  else if (idsBanco.some(r => r !== idApp)) errados.push(`id: okId ${idApp}, banco ${idsBanco.join(' ')}`);
  regra('clean() corta no mesmo tamanho que o banco valida', !corpo ? 'não achei o clean() no app.js' : errados.join('; '));
  // campo do item que o banco aceita e o clean() descarta some no primeiro sync; o contrário,
  // o clean() guardando o que o banco recusa, trava o PUT do evento inteiro
  const doBanco = Object.keys(item).filter(k => !k.startsWith('$') && !k.startsWith('.'));
  const doClean = [...corpo.matchAll(/\bo\.(\w+) =/g)].map(m => m[1]).filter(k => !(k in sala.gone.$i));
  const faltam = [...doBanco.filter(k => !new RegExp(`\\be\\.${k}\\b`).test(corpo)).map(k => `${k}: o banco aceita, clean() descarta`),
    ...doClean.filter(k => !doBanco.includes(k)).map(k => `${k}: clean() guarda, o banco recusa`)];
  regra('clean() e o banco aceitam os mesmos campos no item', faltam.join('; '));
}

// ---------- o sumário do app.js lista as seções, na ordem ----------
// cada seção é um `// #region nome` (o editor dobra) seguido do `// ---------- nome ----------`
{
  const linhas = app.split('\n'), erros = [];
  const ini = linhas.findIndex(l => l.startsWith('  //   ')), sumario = [];
  for (let i = ini; i >= 0 && linhas[i]?.startsWith('  //   '); i++) sumario.push(linhas[i].slice(7));
  const listadas = sumario.join(' ').split('→').map(s => s.trim()).filter(Boolean);
  const secoes = [];
  let aberta = false;
  linhas.forEach((l, i) => {
    const r = l.match(/^\s*\/\/ #(region|endregion)\b ?(.*)$/);
    if (!r) { if (/^\s*\/\/ -{10} /.test(l) && !/#region /.test(linhas[i - 1])) erros.push(`app.js:${i + 1} tem "// ----------" sem #region em cima`); return; }
    if (r[1] === 'region') { if (aberta) erros.push(`app.js:${i + 1} abre "${r[2]}" sem fechar a anterior`); aberta = true; secoes.push(r[2].trim()); }
    else { if (!aberta) erros.push(`app.js:${i + 1} fecha sem abrir`); aberta = false; }
  });
  if (aberta) erros.push('a última #region não fecha');
  const difere = listadas.length !== secoes.length || listadas.some((s, i) => s !== secoes[i]);
  if (difere) erros.push(`sumário: ${listadas.join(' → ') || 'não achei'}\n    seções: ${secoes.join(' → ')}`);
  regra('o sumário do app.js lista as seções, na ordem', erros.join('; '));
}

// ---------- imagens do link abaixo de ~300 KB, senão o WhatsApp ignora ----------
// o index.html e cada pasta de preview (semverba, sextou, fiado, pago, quitado: as que o shareUrl() monta; c/h, c/i, c/j dos links velhos)
{
  const pastas = ['', 'semverba/', 'sextou/', 'fiado/', 'c/h/', 'c/i/', 'c/j/', 'pago/', 'quitado/'];
  const erros = pastas.map(d => {
    const arq = d + 'index.html';
    if (!fs.existsSync(path.join(raiz, arq))) return `${arq} não existe`;
    const og = le(arq).match(/property="og:image" content="https:\/\/tolisa\.com\.br\/([^"]+)"/)?.[1];
    if (!og) return `não achei o og:image no ${arq}`;
    if (!fs.existsSync(path.join(raiz, og))) return `${og} não existe`;
    const kb = fs.statSync(path.join(raiz, og)).size / 1024;
    return kb > 300 && `${og} tem ${kb.toFixed(0)} KB, o WhatsApp ignora acima de ~300`;
  }).filter(Boolean);
  regra('as imagens do link cabem no WhatsApp', erros.join('; '));
}

if (falhas.length) { console.error('\n' + falhas.join('\n')); process.exit(1); }
