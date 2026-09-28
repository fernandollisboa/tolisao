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

// ---------- CSP: script só do próprio site, conexão só com o firebase ----------
// o hash do <script> do fim não mora aqui: se ele quebrar, todo cenário falha (_mundo.cjs)
{
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1] || '';
  const dir = Object.fromEntries(csp.split(';').map(d => d.trim().split(/\s+/)).filter(d => d[0]).map(([k, ...v]) => [k, v]));
  const pode = { 'default-src': ["'self'"], 'script-src': ["'self'", /^'sha256-/], 'connect-src': ["'self'", 'https://*.firebaseio.com'] };
  const errados = Object.entries(pode).flatMap(([k, ok]) => !dir[k] ? [`falta ${k}`]
    : dir[k].filter(v => !ok.some(o => typeof o === 'string' ? o === v : o.test(v))).map(v => `${k} ${v}`));
  regra('a CSP só roda script do site e só fala com o firebase', !csp ? 'não achei o <meta> da CSP no index.html' : errados.join('; '));
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
  const idApp = app.match(/const okId = [^\n]*?(\/\^\[[^/]+\/)/)?.[1];
  const idsBanco = [...new Set([...JSON.stringify(banco).matchAll(/matches\((\/\^\[a-z[^)]+)\)/g)].map(m => m[1]))];
  if (!idApp) errados.push('não achei o okId no app.js');
  else if (idsBanco.some(r => r !== idApp)) errados.push(`id: okId ${idApp}, banco ${idsBanco.join(' ')}`);
  regra('clean() corta no mesmo tamanho que o banco valida', !corpo ? 'não achei o clean() no app.js' : errados.join('; '));
}

// ---------- og6.jpg abaixo de ~300 KB, senão o WhatsApp ignora ----------
{
  const og = html.match(/property="og:image" content="https:\/\/tolisa\.com\.br\/([^"]+)"/)?.[1];
  const kb = og && fs.existsSync(path.join(raiz, og)) ? fs.statSync(path.join(raiz, og)).size / 1024 : NaN;
  regra('a imagem do link cabe no WhatsApp', !og ? 'não achei o og:image no index.html'
    : Number.isNaN(kb) ? `${og} não existe` : kb > 300 && `${og} tem ${kb.toFixed(0)} KB, o WhatsApp ignora acima de ~300`);
}

if (falhas.length) { console.error('\n' + falhas.join('\n')); process.exit(1); }
