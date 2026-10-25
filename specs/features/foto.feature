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

    Exemplo: cada um paga o que pegou, mais a parte dele nos 10%
      Dado uma conta em que se lê:
        """
        CERVEJA
        2 UND x 10,00   20,00
        DRINK
        1 UND x 30,00   30,00
        TAXA DE SERVICO (10%)   5,00
        TOTAL (=)   55,00
        """
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu fotografo a conta
      E na foto, Ana e Beto pegaram a CERVEJA
      E na foto, Caio pegou o DRINK
      E eu anoto o que a foto dividiu
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
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu fotografo a conta
      E na foto, Ana e Beto pegaram o COUVER ARTISTICO
      E na foto, Ana pegou a CERVEJA
      E eu anoto o que a foto dividiu
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
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu fotografo a conta
      Então a foto acha os itens:
        | item               | valor  |
        | MOSCOW MULE        | 32,90  |
        | 6× BUDWEISER 600ML | 113,40 |

    Exemplo: a foto confere os itens com o total da conta
      Dado uma conta em que se lê:
        """
        CERVEJA
        2 UND x 10,00   20,00
        TAXA DE SERVICO (10%)   2,00
        TOTAL (=)   22,00
        """
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu fotografo a conta
      Então a foto diz "bate com o total da conta"

    Exemplo: o item que o leitor errou se corrige na foto
      Dado uma conta em que se lê:
        """
        CERVEJA
        2 UND x 10,00   20,00
        """
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu fotografo a conta
      E na foto, todos pegaram a CERVEJA
      E eu corrijo o valor da CERVEJA pra 24,00 na foto
      E eu anoto o que a foto dividiu
      Então o valor do anotar é 24,00

    Exemplo: a foto em que não se lê item avisa
      Dado uma conta em que não se lê preço nenhum
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu fotografo a conta
      Então a foto diz "não achei item nessa foto"
