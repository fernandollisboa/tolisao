# language: pt
Funcionalidade: Anotar um gasto
  O ✎ abre o formulário: valor, o quê, quem pagou e quem divide.
  Dá pra dividir igualmente ou em partes diferentes.

  Contexto:
    Dado o evento "bailedamada" com Fernando, Júlia, Lia, Mengla e Klinsmann
    E os gastos:
      | o quê                   | valor  | pagou    | divide entre                            |
      | Uber ida                | 18,98  | Lia      | Klinsmann, Mengla, Lia                  |
      | Janta (parte da Lia)    | 18,87  | Júlia    | Lia                                     |
      | Janta (parte da Mengla) | 23,97  | Júlia    | Mengla                                  |
      | Gasolina ida            | 136,00 | Júlia    | Mengla, Lia, Fernando, Júlia            |
      | Airbnb                  | 510,00 | Fernando | Mengla, Lia, Fernando, Júlia, Klinsmann |
      | Uber volta              | 32,50  | Lia      | Lia, Mengla, Fernando, Júlia            |

  Cenário: a lista de itens
    Quando eu abro o evento como Lia
    Então a lista tem 6 itens
    E o primeiro item da lista é "Uber volta" de 32,50
    E o "ver todos" não aparece, porque cabe tudo
    E o ✎ está chamando

  Cenário: ver quem divide um item
    Quando eu abro o evento como Lia
    E eu abro a lista de itens
    E eu toco no ÷ do "Uber volta"
    Então o "Uber volta" mostra quem divide: "÷4 (Lia, Mengla, Fernando, Júlia)"
    Quando eu toco no ÷ do "Uber volta"
    Então o "Uber volta" esconde quem divide

  Cenário: anotar pelo ✎ e o outro aparelho ver
    Quando eu abro o evento como Lia
    E eu anoto "Cerveja" de R$ 50,00 dividido igualmente
    Então o primeiro item da lista é "Cerveja" de 50,00
    E o ✎ continua chamando
    Quando eu abro o evento como Lia em outro aparelho
    Então o primeiro item da lista é "Cerveja" de 50,00

  Cenário: dividir em partes diferentes
    Quando eu abro o evento como Júlia
    E eu toco no ✎
    Então o formulário pede primeiro o valor e depois o quê
    Quando eu preencho R$ 42,84 de "Janta"
    E eu divido só entre Lia e Mengla, em partes diferentes
    E eu ponho R$ 18,87 pra Lia e R$ 20,00 pra Mengla
    Então o formulário diz que faltam R$ 3,97
    E ainda não dá pra anotar
    Quando eu ponho R$ 23,97 pra Mengla
    E eu salvo
    Então o primeiro item da lista é "Janta" de 42,84
    E embaixo dele está escrito "Júlia pagou · Lia 18,87, Mengla 23,97"
    E a lista fica separada em 2 dias
    E falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 198,40 |
      | Lia       | Fernando | 136,71 |
      | Klinsmann | Fernando | 30,77  |
      | Klinsmann | Júlia    | 77,56  |
    Quando eu abro o evento como Lia em outro aparelho
    Então eu devo R$ 136,71 pro Fernando
    E a minha linha no acerto é "Lia → Fernando"

  Cenário: o valor entra pelos centavos, como no app do banco
    Quando eu abro o evento como Lia
    E eu toco no ✎
    E eu digito no valor, tecla por tecla:
      | tecla | fica  |
      | 5     | 0,05  |
      | 0     | 0,50  |
      | 0     | 5,00  |
      | 0     | 50,00 |
    E eu apago o último dígito
    Então o valor fica "5,00"
    Quando eu digito "1234567" no valor
    Então o valor fica "5.001.234,56"

  Cenário: as ajudas de conta das partes diferentes
    Quando eu abro o evento como Lia
    E eu toco no ✎
    E eu preencho R$ 120,00 de "Airbnb"
    Então a frase de como está dividido vem antes das abas
    Quando eu toco na aba das partes diferentes
    Então a aba das partes diferentes fica marcada
    E os chips de quem divide somem
    Quando eu ponho R$ 40,00 pra Fernando
    Então o formulário diz que faltam R$ 80,00
    E ainda não dá pra anotar
    Quando eu toco em "dividir o resto igual"
    Então as partes ficam:
      | pessoa    | parte |
      | Fernando  | 40,00 |
      | Júlia     | 20,00 |
      | Lia       | 20,00 |
      | Mengla    | 20,00 |
      | Klinsmann | 20,00 |
    E já dá pra anotar
    Quando eu tiro o Klinsmann da divisão
    Então o Klinsmann sai também dos chips de quem divide
    E o formulário diz que faltam R$ 20,00
    Quando eu apago a parte da Júlia e toco em "o resto" nela
    Então a parte da Júlia fica "40,00"
    E o formulário diz que fechou
