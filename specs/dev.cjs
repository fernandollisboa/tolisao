// npm run dev: o site na máquina com o banco e a API falsos (_banco.cjs e _api.cjs), sem tocar
// no Firebase nem no worker de verdade. Tudo some ao fechar. `npm run dev -- --festa` já abre
// com o bailedamada de _festa.cjs; PORTA=9000 troca a porta (padrão 8000)
const servir = require('./_serve.cjs');
const { Banco } = require('./_banco.cjs');
const { Api } = require('./_api.cjs');
const festa = require('./_festa.cjs');

const banco = new Banco(), api = new Api();
const id = n => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
let caminho = '/';
if (process.argv.includes('--festa')) {
  const { gente, gastos } = festa.bailedamada, ontem = Date.now() - 86400000;
  banco.sala({ name: 'bailedamada', people: gente.map((n, i) => ({ id: id(n), name: n, at: i + 1 })), deleted: [],
    expenses: gastos.map((g, i) => ({ id: 'g' + (i + 1), desc: g['o quê'], at: ontem + i * 60000, payer: id(g.pagou),
      amount: Math.round(Number(g.valor.replace(/\./g, '').replace(',', '.')) * 100) / 100,
      among: g['divide entre'].split(/\s*,\s*/).map(id) })) });
  caminho = '/?evento=bailedamada';
}
// a API falsa só anota: mostra aqui o que o app pediu
const responde = api.responde.bind(api);
api.responde = (m, rota, texto, origem) => { const res = responde(m, rota, texto, origem); if (m === 'POST') console.log(`api ${rota} ${texto}`); return res; };

servir({ banco, api, porta: Number(process.env.PORTA) || 8000 }).then(({ porta }) => {
  api.origens = `http://localhost:${porta}`; // a digital (?digital) vale na máquina, com rpId localhost
  console.log(`tô lisa na máquina, com banco falso: http://localhost:${porta}${caminho}`);
});
