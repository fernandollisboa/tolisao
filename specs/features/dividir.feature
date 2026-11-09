# language: pt
Funcionalidade: Quanto fica pra cada um
  Antes de anotar, o formulário diz quanto o gasto fica pra cada um.

  Contexto:
    Dado o evento "racha" com Ana, Beto e Caio

  Regra: no empréstimo, a frase do anotar diz quanto o outro passa a dever
    O valor entra pelos centavos, como no app do banco: quem empresta R$ 90 vê o valor certo antes de anotar.

    Exemplo: no empréstimo, a frase diz quanto o outro passa a dever
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu digito "9000" no valor
      E eu divido só com Beto
      Então a frase de como está dividido diz "Empréstimo: Beto deve R$ 90,00 a Ana."

  Regra: quem pagou fica com o centavo que sobra
    R$ 100,00 entre três não fecha. Quem deve paga o mesmo valor, arredondado pra cima, e quem pagou
    fica com a diferença: duas pessoas devendo diferente o que se dividiu igual fica esquisito.

    Exemplo: R$ 100,00 entre três, quem deve paga o mesmo
      Quando eu abro o evento como Ana
      E eu anoto "Mercado" de R$ 100,00 dividido igualmente
      Então falta pagar:
        | quem | paga pra | valor |
        | Beto | Ana      | 33,34 |
        | Caio | Ana      | 33,34 |

    Exemplo: o gasto com centavo sobrando continua dividido igualmente
      Quando eu abro o evento como Ana
      E eu anoto "Mercado" de R$ 100,00 dividido igualmente
      Então embaixo dele está escrito "Ana pagou · ÷3"
      Quando eu edito o "Mercado"
      Então a aba igual fica marcada

    Exemplo: trocar só a descrição não muda quem leva o centavo a mais
      Quando eu abro o evento como Ana
      E eu anoto "Mercado" e depois "Gás", os dois de R$ 100,00 divididos igualmente
      E eu edito o "Mercado"
      E eu troco a descrição do "Mercado" pra "Feira" e salvo
      Então no banco, o centavo a mais do "Feira" continua com a mesma pessoa

  Regra: até 5 centavos ninguém cobra
    Quem pagou uns centavos a menos, ou ficou devendo um centavo do arredondamento, está quite.

    Exemplo: quem pagou 4 centavos a menos sai do falta pagar
      Dado os gastos:
        | o quê   | valor  | pagou | divide entre    |
        | Mercado | 100,00 | Ana   | Ana, Beto, Caio |
      E que o Beto já pagou R$ 33,30 pra Ana
      Quando eu abro o evento como Ana
      Então falta pagar:
        | quem | paga pra | valor |
        | Caio | Ana      | 33,33 |
