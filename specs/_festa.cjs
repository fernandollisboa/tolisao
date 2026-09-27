// A festa que serve de exemplo pro acerto e pro anotar.
// Estava escrita igual, byte a byte, nos dois .feature: mudar um valor num só
// quebrava o outro em cascata. Agora mora aqui, no formato da tabela do Gherkin.
// Mexeu num valor, mexeu no acerto dos dois arquivos: confira as duas tabelas
// de "falta pagar" (acerto.feature e anotar.feature) antes de subir.

const COLUNAS = ['o quê', 'valor', 'pagou', 'divide entre'];
const linhas = tabela => tabela.map(vals => Object.fromEntries(COLUNAS.map((c, i) => [c, vals[i]])));

module.exports = {
  bailedamada: {
    gente: ['Fernando', 'Júlia', 'Lia', 'Mengla', 'Klinsmann'],
    gastos: linhas([
      // o quê                     valor     pagou       divide entre
      ['Uber ida',                 '18,98',  'Lia',      'Klinsmann, Mengla, Lia'],
      ['Janta (parte da Lia)',     '18,87',  'Júlia',    'Lia'],
      ['Janta (parte da Mengla)',  '23,97',  'Júlia',    'Mengla'],
      ['Gasolina ida',            '136,00',  'Júlia',    'Mengla, Lia, Fernando, Júlia'],
      ['Airbnb',                  '510,00',  'Fernando', 'Mengla, Lia, Fernando, Júlia, Klinsmann'],
      ['Uber volta',               '32,50',  'Lia',      'Lia, Mengla, Fernando, Júlia'],
    ]),
  },
};
