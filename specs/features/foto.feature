# language: pt
Funcionalidade: Foto da conta
  No bar, a conta chega impressa e ninguém sabe de cabeça quanto deu pra cada um. A pessoa fotografa a conta,
  toca em cada item e em quem pegou, e o anotar já vem dividido: cada um paga o que pegou, mais a parte dele no serviço.
  Ainda é protótipo do modo mesa: só aparece pra quem pediu pra testar.

  Contexto:
    Dado o evento "bar" com Ana, Beto e Caio

  Cenário: sem pedir pra testar, o anotar não tem a câmera
    Quando eu abro o evento como Ana
    E eu toco no ✎
    Então o anotar não tem a câmera

  Cenário: quem ligou a foto pelo link antigo continua com a câmera
    O teste da foto passou pra dentro do modo mesa: quem já testava não precisa ligar de novo.
    Dado que eu tinha ligado a foto da conta pelo link antigo
    Quando eu abro o evento como Ana
    E eu toco no ✎
    Então o anotar tem a câmera

  Regra: pra quem pediu pra testar, a foto divide a conta pelo que cada um pegou

    Contexto:
      Dado que eu pedi pra testar o modo mesa
      E que eu estou no anotar, como Ana

    Exemplo: cada um paga o que pegou, mais a parte dele nos 10%
      Dado uma conta em que se lê:
        """
        CERVEJA
        2 UND x 10,00   20,00
        DRINK
        1 UND x 30,00   30,00
        TAXA DE SERVICO (10%)   5,00
        """
      Quando eu fotografo a conta
      E na foto, Ana e Beto pegaram a CERVEJA
      E na foto, Caio pegou o DRINK
      E eu uso o que a foto dividiu
      Então o valor do anotar é 55,00
      E as partes ficam:
        | pessoa | parte |
        | Ana    | 11,00 |
        | Beto   | 11,00 |
        | Caio   | 33,00 |

    Exemplo: o couver é do músico e fica fora dos 10%
      Dado uma conta em que se lê:
        """
        COUVER ARTISTICO
        2 UND x 15,00   30,00
        CERVEJA
        1 UND x 20,00   20,00
        TAXA DE SERVICO (10%)   2,00
        """
      Quando eu fotografo a conta
      E na foto, Ana e Beto pegaram o COUVER ARTISTICO
      E na foto, Ana pegou a CERVEJA
      E eu uso o que a foto dividiu
      Então as partes ficam:
        | pessoa | parte |
        | Ana    | 37,00 |
        | Beto   | 15,00 |

    Exemplo: a impressora comeu o último dígito, e o item vale a quantidade vezes o preço
      Conta de bar sai com a coluna da direita cortada, e o leitor confunde o 1 com o 7: o preço da unidade e o
      pedaço que sobrou do total bastam pra achar quantos foram.
      Dado uma conta em que se lê:
        """
        MOSCOW MULE
        7 UND x 32,90   32,9
        BUDWEISER 600ML
        6 UND x 18,90   113,4
        """
      Quando eu fotografo a conta
      Então a foto acha os itens:
        | item               | valor  |
        | MOSCOW MULE        | 32,90  |
        | 6× BUDWEISER 600ML | 113,40 |

    Exemplo: no cupom fiscal o item vem numa linha só, com o número e o código na frente
      Dado uma conta em que se lê:
        """
        1 4175 Pingado 1 06T   4,30G
        2 41015 Pao Semolina Gde 2 x 10,90 06T   21,80G
        TOTAL R$   26,10
        """
      Quando eu fotografo a conta
      Então a foto acha os itens:
        | item                | valor |
        | Pingado             | 4,30  |
        | 2× Pao Semolina Gde | 21,80 |

    Esquema do Cenário: a foto confere os itens com o total da conta
      Dado uma conta em que se lê:
        """
        CERVEJA
        2 UND x 10,00   20,00
        TAXA DE SERVICO (10%)   2,00
        TOTAL (=)   <total>
        """
      Quando eu fotografo a conta
      Então a foto diz "<aviso>"

      Exemplos:
        | total | aviso                                  |
        | 22,00 | bate com o total da conta              |
        | 32,00 | li R$ 32,00 no total da conta          |

    Exemplo: a lista da foto se arruma à mão
      O leitor erra: lê o que não é item, perde item e troca número. Tudo se corrige no cartão.
      Dado uma conta em que se lê:
        """
        CERVEJA
        2 UND x 10,00   20,00
        GUARDANAPO
        1 UND x 3,00   3,00
        """
      Quando eu fotografo a conta
      E eu tiro o GUARDANAPO da foto
      E eu corrijo o valor da CERVEJA pra 24,00 na foto
      E eu ponho à mão um item de 8,00 que faltou na foto
      E na foto, Beto pegou o item
      E na foto, Ana pegou a CERVEJA
      E eu desligo os 10% da foto
      E eu uso o que a foto dividiu
      Então as partes ficam:
        | pessoa | parte |
        | Ana    | 24,00 |
        | Beto   | 8,00  |

    Exemplo: ler de novo não perde quem pegou o quê
      Dado uma conta em que se lê:
        """
        CERVEJA
        2 UND x 10,00   20,00
        """
      Quando eu fotografo a conta
      E na foto, Ana e Beto pegaram a CERVEJA
      E eu leio a foto de novo, com mais contraste
      Então na foto, a CERVEJA continua com Ana, Beto

    Exemplo: a foto em que não se lê item avisa
      Dado uma conta em que não se lê preço nenhum
      Quando eu fotografo a conta
      Então a foto diz "não achei item nessa foto"

  Regra: as contas de verdade de specs/contas saem com os valores delas
    O que o leitor leu de cada foto fica guardado do lado dela (npm run contas -- --grava): aqui o app recebe essa
    leitura no lugar do leitor, e a conta tem que fechar no total impresso.

    Contexto:
      Dado que eu pedi pra testar o modo mesa
      E que eu estou no anotar, como Ana

    Esquema do Cenário: a conta "<conta>" fecha em R$ <total>
      Dado a foto da conta "<conta>", como o leitor leu
      Quando eu fotografo a conta
      E na foto, todos pegaram tudo
      Então a foto acha os valores da conta "<conta>"
      E a foto dá R$ <total>

      Exemplos:
        | conta                  | total  |
        | caranguejo             | 257,12 |
        | frango-assado          | 46,90  |
        | alimentacao-consciente | 6,05   |
        | pao-a-quilo            | 3,70   |
