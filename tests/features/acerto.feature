# language: pt
Funcionalidade: Acertar as contas
  Minha conta diz quanto eu devo ou tenho a receber, e é de lá que eu ajo:
  o ✔ quita e o copiar pix já vai com o valor. Falta pagar só mostra.

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

  Cenário: o acerto é o mínimo de transferências
    Quando eu abro o evento como Lia
    Então falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 174,43 |
      | Lia       | Fernando | 117,84 |
      | Klinsmann | Fernando | 73,61  |
      | Klinsmann | Júlia    | 34,72  |
    E a minha linha no acerto é "Lia → Fernando"
    E o Falta pagar não tem botão nenhum

  Cenário: a nota de quem deve
    Quando eu abro o evento como Lia
    Então Minha conta diz "eu devo" R$ 117,84
    E eu devo R$ 117,84 pro Fernando
    E eu vejo 1 botão de quitar em Minha conta
    E o subtítulo diz "pra quem eu devo?"
    E o sincronizado fica no rodapé, depois do código de barras
    E a página não fica mais larga que a tela

  Cenário: a nota de quem tem a receber
    Quando eu abro o evento como Júlia
    Então Minha conta diz "me devem" R$ 34,72
    E o Klinsmann me deve R$ 34,72
    E eu vejo 0 botões de quitar em Minha conta

  Cenário: quitar pelo ✔
    Quando eu abro o evento como Lia
    E eu quito a primeira linha de Minha conta
    Então falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 174,43 |
      | Klinsmann | Fernando | 73,61  |
      | Klinsmann | Júlia    | 34,72  |

  Cenário: quitar e avisar no zap
    Quando eu abro o evento como Lia
    E eu quito a primeira linha de Minha conta e aviso no zap
    Então o zap abre com a mensagem:
      """
      ✅ Fernando, te paguei R$ 117,84 do *bailedamada* 👍
      {link do evento}
      """

  Cenário: copiar o pix já com o valor
    Dado que o Fernando tem a chave pix "7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d"
    Quando eu abro o evento como Lia
    E eu toco em copiar pix
    Então fica copiado o pix copia e cola:
      """
      00020126580014br.gov.bcb.pix01367d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d5204000053039865406117.845802BR5908FERNANDO6006BRASIL62070503***630476B9
      """

  Cenário: mandar a comanda pro zap
    Dado que o Fernando tem a chave pix "fernando@exemplo.com"
    Quando eu abro o evento como Lia
    E eu quito a primeira linha de Minha conta
    E eu toco em enviar
    Então baixa a imagem "evento-bailedamada.png"
    E o zap abre com a mensagem:
      """
      🧾 acerto do *bailedamada*

      💸 Mengla paga R$ 174,43 pra Fernando (pix: fernando@exemplo.com)
      💸 Klinsmann paga R$ 73,61 pra Fernando (pix: fernando@exemplo.com)
      💸 Klinsmann paga R$ 34,72 pra Júlia

      tudo aqui 👉 {link do evento}
      """
