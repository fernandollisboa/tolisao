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

// ---------- CSP: script só do próprio site e do Cloudflare Web Analytics, conexão só com o firebase, a API do aviso e o Cloudflare ----------
// o hash do <script> do fim não mora aqui: se ele quebrar, todo cenário falha (_mundo.cjs)
{
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1] || '';
  const dir = Object.fromEntries(csp.split(';').map(d => d.trim().split(/\s+/)).filter(d => d[0]).map(([k, ...v]) => [k, v]));
  const pode = { 'default-src': ["'self'"], 'script-src': ["'self'", /^'sha256-/, 'https://static.cloudflareinsights.com'], 'connect-src': ["'self'", 'https://*.firebaseio.com', 'https://tolisa-api.fernando-costa-fd0.workers.dev', 'https://cloudflareinsights.com'] };
  const errados = Object.entries(pode).flatMap(([k, ok]) => !dir[k] ? [`falta ${k}`]
    : dir[k].filter(v => !ok.some(o => typeof o === 'string' ? o === v : o.test(v))).map(v => `${k} ${v}`));
  regra('a CSP só roda script do site e do Cloudflare e só fala com o firebase, a API e o Cloudflare', !csp ? 'não achei o <meta> da CSP no index.html' : errados.join('; '));
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

// ---------- pix: o banco aceita o que o app no ar grava, e só isso ----------
// as regras sobem junto com o site (regras.yml): aparelho com tok velho (4 × uid() do Math.random,
// 8 letras ou menos cada) ou que apaga a chave gravando key '' não pode levar 401.
// Roda as expressões do database.rules.json como o Firebase: .write no nó, .validate em cada nó escrito
{
  const no = banco.rules.pix?.$room?.$person || {}, erros = [];
  const snap = v => ({ val: () => v ?? null, exists: () => v != null, isString: () => typeof v === 'string',
    isNumber: () => typeof v === 'number', child: k => snap(v?.[k]), hasChildren: ks => ks.every(k => v?.[k] != null) });
  const avalia = (expr, vars) => {
    String.prototype.matches = function (re) { return re.test(String(this)); };
    try { return new Function(...Object.keys(vars), `return (${expr});`)(...Object.values(vars)) === true; }
    finally { delete String.prototype.matches; }
  };
  // o PUT do putPix(): passa o .write do nó e o .validate dele e de cada filho (filho sem regra cai no $outro; sem $outro, passa)
  const grava = (sala, pessoa, antes, novo) => {
    const vars = { $room: sala, $person: pessoa, data: snap(antes), newData: snap(novo) };
    if (!avalia(no['.write'] || 'false', vars) || !avalia(no['.validate'] || 'true', vars)) return false;
    return Object.entries(novo).every(([k, v]) => {
      const r = no[k] ?? no.$outro;
      return !r || (r['.validate'] !== false && avalia(r['.validate'] ?? 'true', { ...vars, newData: snap(v) }));
    });
  };
  const sala = 'ab'.repeat(32), tok = 'a1'.repeat(16), velho = 'k3j9x0q2'.repeat(4), curto = 'q2';
  const casos = [
    ['cadastra a chave', true, sala, 'k3j9x0q2', null, { key: '+5571987654321', tok }],
    ['troca com o mesmo tok', true, sala, 'k3j9x0q2', { key: '+5571987654321', tok }, { key: 'eu@exemplo.com', tok }],
    ['apaga gravando key vazia', true, sala, 'k3j9x0q2', { key: 'eu@exemplo.com', tok }, { key: '', tok }],
    ['outro aparelho cadastra depois de apagada', true, sala, 'k3j9x0q2', { key: '', tok }, { key: '+5571987654321', tok: velho }],
    ['tok velho de 4 × uid()', true, sala, 'k3j9x0q2', { key: 'x@y.z', tok: velho }, { key: '', tok: velho }],
    ['tok velho curto (Math.random raso)', true, sala, 'k3j9x0q2', null, { key: 'x@y.z', tok: curto }],
    ['chave aleatória', true, sala, 'k3j9x0q2', null, { key: '123e4567-e89b-12d3-a456-426614174000', tok }],
    ['e-mail de 80', true, sala, 'k3j9x0q2', null, { key: 'a'.repeat(70) + '@exemplo.c', tok }],
    ['tok de outro aparelho', false, sala, 'k3j9x0q2', { key: 'x@y.z', tok }, { key: 'meu@golpe.com', tok: velho }],
    ['e-mail de 81', false, sala, 'k3j9x0q2', null, { key: 'a'.repeat(71) + '@exemplo.c', tok }],
    ['sala fora do hash', false, 'bailedamada', 'k3j9x0q2', null, { key: 'x@y.z', tok }],
    ['pessoa fora do id', false, sala, 'Fulano', null, { key: 'x@y.z', tok }],
    ['tok fora do formato', false, sala, 'k3j9x0q2', null, { key: 'x@y.z', tok: 'tok-de-outro-aparelho' }],
    ['tok de 33', false, sala, 'k3j9x0q2', null, { key: 'x@y.z', tok: tok + 'a' }],
    ['campo a mais', false, sala, 'k3j9x0q2', null, { key: 'x@y.z', tok, lixo: 'x'.repeat(1000) }],
    ['sem tok', false, sala, 'k3j9x0q2', null, { key: 'x@y.z' }],
  ];
  for (const [nome, ok, s, p, antes, novo] of casos) {
    let deu;
    try { deu = grava(s, p, antes, novo); } catch (e) { deu = `erro: ${e.message}`; }
    if (deu !== ok) erros.push(`${nome}: esperava ${ok ? 'aceitar' : 'recusar'}, ${deu === true ? 'aceitou' : deu === false ? 'recusou' : deu}`);
  }
  // o tok que o app sorteia hoje cabe no que o banco aceita
  const n = +(app.match(/tok = sorteia\((\d+)\)/)?.[1] ?? NaN), cabe = +(no.tok?.['.validate']?.match(/\{1,(\d+)\}/)?.[1] ?? NaN);
  if (!(n <= cabe)) erros.push(`o app sorteia tok de ${n}, o banco aceita até ${cabe}`);
  regra('o pix aceita o que o app grava e recusa o resto', erros.join('; '));
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
  // o mesmo pro item apagado: campo do gone que o banco aceita e o clean() não lê some no sync
  const doGone = Object.keys(sala.gone.$i).filter(k => !k.startsWith('$') && !k.startsWith('.'));
  regra('clean() lê todo campo do item apagado que o banco aceita',
    doGone.filter(k => !new RegExp(`\\bg\\.${k}\\b`).test(corpo)).map(k => `${k}: o banco aceita, clean() descarta`).join('; '));
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
