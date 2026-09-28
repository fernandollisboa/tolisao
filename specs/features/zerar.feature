# language: pt
Funcionalidade: A conta zera quando todo mundo fica quite
  Quando todo mundo fica quite, o que foi pago até ali já está acertado. O Falta
  pagar recomeça do zero: gasto novo não traz de volta a quitação de antes.

  Contexto:
    Dado o evento "rolezinho" com Fernando, Tomaz e Lia
    E os gastos:
      | o quê | valor  | pagou    | divide entre    |
      | Pizza | 100,00 | Fernando | Fernando, Tomaz |

  Cenário: quitou tudo, a quitação sai do Falta pagar quando vem gasto novo
    Quando eu abro o evento como Tomaz
    E eu quito a primeira linha de Minha conta
    E eu anoto "Cerveja" de R$ 30,00 dividido igualmente
    Então falta pagar:
      | quem     | paga pra | valor |
      | Fernando | Tomaz    | 10,00 |
      | Lia      | Tomaz    | 10,00 |
    E nenhum pagamento está carimbado

  Cenário: quitou só uma parte, a quitação continua à vista
    Dado os gastos:
      | o quê   | valor | pagou | divide entre    |
      | Cerveja | 30,00 | Lia   | Fernando, Lia   |
    Quando eu abro o evento como Tomaz
    E eu quito a primeira linha de Minha conta
    E eu anoto "Gelo" de R$ 10,00 dividido igualmente
    Então o pagamento "Tomaz → Fernando" continua carimbado
