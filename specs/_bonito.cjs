const fs = require('fs'), path = require('path');

const cor = !process.env.NO_COLOR;
const pinta = c => t => cor ? `\x1b[${c}m${t}\x1b[0m` : t;
const verde = pinta(32), vermelho = pinta(31), ciano = pinta(36), cinza = pinta(90), negrito = pinta(1), amarelo = pinta(33);
const PASSO = /^\s*(Dado|Dada|Dados|Dadas|Quando|Então|Entao|E|Mas|\*)\s/;
const BLOCO = /^\s*(Contexto|Cenário|Cenario|Exemplo):/;

const passosDe = passos => passos.flatMap(s => s.category === 'test.step' ? [s] : passosDe(s.steps || []));
const erroDe = s => s.error || (s.steps || []).map(c => c.error).find(Boolean);
const fonteDe = arq => arq.replace(`${path.sep}.gerado${path.sep}`, path.sep).replace(/\.spec\.js$/, '');
const tira = t => t.replace(/\x1b\[[0-9;]*m/g, '');

class Bonito {
  onBegin(config, suite) {
    this.ini = Date.now(); this.porArquivo = new Map(); this.falhas = [];
    this.conta = { cenarios: { ok: 0, falhou: 0, pulou: 0 }, passos: { ok: 0, falhou: 0, pulou: 0 } };
    for (const t of suite.allTests()) { const f = t.location.file; if (!this.porArquivo.has(f)) this.porArquivo.set(f, { faltam: 0, testes: new Map() }); this.porArquivo.get(f).faltam++; }
  }

  onTestEnd(test, result) {
    const f = this.porArquivo.get(test.location.file); f.testes.set(test.title, { test, result });
    if (result.status !== 'passed' && result.status !== 'skipped') this.falhas.push({ test, result });
    if (--f.faltam === 0) this.imprime(test.location.file, f.testes);
  }

  imprime(arq, testes) {
    const fonte = fs.readFileSync(fonteDe(arq), 'utf8').split('\n');
    const todos = [...testes.values()];
    const doContexto = s => { for (let p = s.parent; p; p = p.parent) if (p.category === 'hook') return true; return false; };
    const contexto = (todos.map(({ result }) => passosDe(result.steps).filter(doContexto)).find(c => c.length)) || [];
    const saida = ['']; let bloco = null, fila = [], tinta = cinza, pendente = [];
    const solta = () => { saida.push(...pendente); pendente = []; };
    const fecha = () => {
      solta();
      if (bloco && bloco !== 'contexto' && bloco.result.status !== 'passed' && !passosDe(bloco.result.steps).some(erroDe)) {
        saida.push(...this.erro(bloco.result.error || { message: bloco.result.status }, '    ')); }
    };
    for (const linha of fonte) {
      if (/^\s*#/.test(linha)) continue;
      if (/^\s*@/.test(linha)) { saida.push(ciano(linha)); continue; }
      const b = linha.match(BLOCO);
      if (b || /^\s*Funcionalidade:/.test(linha)) {
        fecha(); tinta = cinza;
        if (b && b[1] === 'Contexto') { bloco = 'contexto'; fila = [...contexto]; }
        else if (b) {
          const t = testes.get(linha.replace(BLOCO, '').trim()); bloco = t || null;
          fila = t ? passosDe(t.result.steps).filter(s => !doContexto(s)) : [];
          if (t) this.conta.cenarios[t.result.status === 'passed' ? 'ok' : t.result.status === 'skipped' ? 'pulou' : 'falhou']++;
        }
        saida.push(negrito(linha)); continue;
      }
      if (PASSO.test(linha) && bloco) {
        solta();
        const falhou = bloco === 'contexto' ? todos.some(({ result }) => result.status !== 'passed') : bloco.result.status !== 'passed';
        const s = fila.shift(), e = s && falhou ? erroDe(s) : null, estado = !s ? 'pulou' : e ? 'falhou' : 'ok';
        if (bloco !== 'contexto') this.conta.passos[estado]++;
        tinta = estado === 'ok' ? verde : estado === 'falhou' ? vermelho : ciano;
        if (e) pendente = this.erro(e, linha);
        saida.push(tinta(linha)); continue;
      }
      if (!linha.trim()) { solta(); tinta = bloco ? tinta : cinza; saida.push(''); continue; }
      saida.push(tinta(linha));
    }
    fecha();
    console.log(saida.join('\n').replace(/\n+$/, ''));
  }

  erro(e, linha) {
    const recuo = ' '.repeat((linha.match(/^\s*/)[0].length) + 2);
    const msg = tira(e.message || String(e)).split('\n').filter(l => l.trim()).slice(0, 24);
    return msg.map(l => vermelho(recuo + l));
  }

  onEnd(result) {
    const { cenarios: c, passos: p } = this.conta;
    const verbo = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
    const resumo = (n, o) => { const partes = [o.ok && verde(verbo(o.ok, 'passou', 'passaram')), o.falhou && vermelho(verbo(o.falhou, 'falhou', 'falharam')), o.pulou && ciano(verbo(o.pulou, 'pulou', 'pularam'))].filter(Boolean);
      const total = o.ok + o.falhou + o.pulou; return `${total} ${total === 1 ? n : n + 's'} (${partes.join(', ') || 'nenhum'})`; };
    const s = Math.round((Date.now() - this.ini) / 1000);
    console.log(`\n${resumo('cenário', c)}\n${resumo('passo', p)}\n${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`);
    const falhas = this.falhas;
    if (falhas.length) {
      console.log(vermelho('\nfalharam:'));
      for (const { test, result } of falhas) {
        const trace = result.attachments.find(a => a.name === 'trace');
        console.log(vermelho(`  ${path.relative(process.cwd(), fonteDe(test.location.file))} › ${test.title}`) + (trace ? cinza(`\n    npx playwright show-trace ${path.relative(process.cwd(), trace.path)}`) : ''));
      }
    }
    if (result.status === 'interrupted' || result.status === 'timedout') console.log(amarelo(`\nparou antes do fim (${result.status})`));
  }

  printsToStdio() { return true; }
}

module.exports = Bonito;
