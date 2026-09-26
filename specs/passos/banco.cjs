const { Then, expect } = require('./_mundo.cjs');

// cada linha do exemplo: o que fazer com a sala antes de gravar
const MUDA = {
  'nada de diferente': s => s,
  'um campo a mais': s => ({ ...s, lixo: 'x' }),
  'um campo a mais no gasto': s => { s.expenses[0].lixo = 1; return s; },
  'nome com 41 letras': s => ({ ...s, name: 'x'.repeat(41) }),
  'pessoa sem nome': s => { delete s.people[0].name; return s; },
  'valor em texto': s => { s.expenses[0].amount = '300'; return s; },
  'id com maiúscula': s => { s.people[0].id = 'Fernando'; return s; },
  'gasto sem ninguém dividindo': s => { s.expenses[0].among = []; return s; },
  'parte negativa': s => { s.expenses[0].shares = { julia: -100 }; return s; },
  '10001 gastos': s => ({ ...s, expenses: Array.from({ length: 10001 }, (_, i) => ({ ...s.expenses[0], id: 'g' + i })) }),
  'versão 3': s => ({ ...s, v: 3 }),
  'texto no lugar da sala': () => '<script>alert(1)</script>',
};

Then('gravar a sala direto no banco dá:', async ({ mundo }, tabela) => {
  const url = `https://fake-db.firebaseio.com/rooms/${mundo.sala}.json`;
  for (const { com, 'o banco': esperado } of tabela.hashes()) {
    const antes = JSON.stringify(mundo.banco.pega(['rooms', mundo.sala]));
    // o evento do Dado não tem v nem updatedAt: parte da sala como o app grava, sem depender de ele já ter gravado
    const sala = MUDA[com]({ v: 2, updatedAt: Date.now(), ...JSON.parse(antes) });
    const status = await mundo.p.evaluate(async ([url, corpo]) => (await fetch(url, { method: 'PUT', body: corpo })).status, [url, JSON.stringify(sala)]);
    const depois = JSON.stringify(mundo.banco.pega(['rooms', mundo.sala]));
    if (esperado === 'recusa') { mundo.recusasEsperadas++; expect(status, com).toBe(401); expect(depois, com).toBe(antes); }
    else expect(status, com).toBe(200);
  }
});
