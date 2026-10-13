# language: pt
Funcionalidade: A conta zera quando todo mundo fica quite
  Quando todo mundo fica quite, o que foi pago até ali já está acertado. O Falta
  pagar recomeça do zero: gasto novo não traz de volta a quitação de antes.

  Contexto:
    Dado o evento "rolezinho" com Fernando, Tomaz e Lia
    E os gastos:
      | o quê | valor  | pagou    | divide entre    |
      | Pizza | 100,00 | Fernando | Fernando, Tomaz |

  Cenário: quitou tudo, os pagamentos ficam à vista
    Com todo mundo quite não falta pagar nada, mas a turma ainda quer ver quem pagou quem.
    Quando eu abro o evento como Tomaz
    E eu quito a primeira linha de Minha conta
    Então o pagamento "Tomaz → Fernando" continua carimbado
    E o Falta pagar se chama "Pagamentos"
    E Minha conta diz "tudo quite!"

  Cenário: quite sozinho, com a turma ainda devendo
    O recado diz de quem é a conta quite, pra ninguém achar que o evento acabou.
    Quando eu abro o evento como Lia
    Então Minha conta diz "Lia tá quite!"

  Cenário: desfazer o pagamento que zerou a conta traz o Falta pagar de volta
    Quando eu abro o evento como Tomaz
    E eu quito a primeira linha de Minha conta
    E eu desfaço o pagamento "Tomaz → Fernando"
    Então nenhum pagamento está carimbado
    E o Falta pagar se chama "Falta pagar"
    E falta pagar:
      | quem  | paga pra | valor |
      | Tomaz | Fernando | 50,00 |

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
