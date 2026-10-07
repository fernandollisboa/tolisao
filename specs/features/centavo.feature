# language: pt
Funcionalidade: O centavo que sobra da divisão
  R$ 100,00 entre três não fecha: alguém paga R$ 33,34. Se é sempre o primeiro da turma,
  em quarenta gastos vira assunto no grupo.

  Contexto:
    Dado o evento "racha" com Ana, Beto e Caio

  Cenário: dois gastos de R$ 100,00 entre três, cada centavo a mais com uma pessoa
    Quando eu abro o evento como Ana
    E eu anoto "Mercado" e depois "Gás", os dois de R$ 100,00 divididos igualmente
    Então no banco, o centavo a mais do "Mercado" e o do "Gás" ficam com pessoas diferentes

  Cenário: o gasto com centavo sobrando continua dividido igualmente
    Quando eu abro o evento como Ana
    E eu anoto "Mercado" de R$ 100,00 dividido igualmente
    Então embaixo dele está escrito "Ana pagou · ÷3"
    Quando eu edito o "Mercado"
    Então a aba igual fica marcada

  Cenário: editar um gasto de antes não muda o centavo de dono
    Uma conta que já fechou continua fechada: só o gasto anotado daqui pra frente gira o centavo.
    Dado os gastos:
      | o quê   | valor  | pagou | divide entre    |
      | Mercado | 100,00 | Ana   | Ana, Beto, Caio |
    Quando eu abro o evento como Ana
    E eu abro a lista de itens
    E eu edito o "Mercado"
    E eu salvo
    Então o anotar fecha
    E o Beto me deve R$ 33,33
    E o Caio me deve R$ 33,33
