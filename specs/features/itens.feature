# language: pt
Funcionalidade: A linha dos itens
  Fechada, ela é um botão com moldura que convida: "ver os 3 itens".
  Depois que a pessoa abre uma vez, vira só a contagem.

  Contexto:
    Dado o evento "bailedamada" com Fernando, Júlia, Lia, Mengla e Klinsmann
    E os gastos:
      | o quê    | valor  | pagou    | divide entre                            |
      | Airbnb   | 510,00 | Fernando | Fernando, Júlia, Lia, Mengla, Klinsmann |
      | Gasolina | 136,00 | Júlia    | Júlia, Lia, Mengla, Klinsmann           |
      | Janta    | 42,84  | Júlia    | Lia, Mengla                             |

  Cenário: convida até abrir uma vez
    Quando eu abro o evento como Lia
    Então a linha dos itens diz "ver os 3 itens", com moldura
    Quando eu toco na linha dos itens
    Então a linha dos itens diz "3 itens", sem moldura
    Quando eu toco na linha dos itens
    Então a linha dos itens diz "3 itens", com moldura
    Quando eu troco pra Mengla
    Então a linha dos itens diz "ver os 3 itens", com moldura

  Cenário: pelo teclado
    Quando eu abro o evento como Lia
    E eu aperto Enter na linha dos itens
    Então a lista de itens está aberta
    Quando eu aperto Espaço na linha dos itens
    Então a lista de itens está fechada
