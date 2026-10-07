# language: pt
Funcionalidade: Acertar as contas
  Minha conta diz quanto eu devo ou tenho a receber, e é de lá que eu ajo:
  o ✔ quita, o copiar pix já vai com o valor e o cobrar manda no zap o link
  de quem me deve. Falta pagar só mostra.

  # a mesma festa do anotar.feature, repetida de propósito: as contas daqui saem desta
  # tabela, e quem lê confere os números sem abrir outro arquivo
  # quem é e quanto gastou cada um está em specs/_festa.cjs, na forma desta tabela
  Contexto:
    Dado o evento de exemplo "bailedamada"

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

  Cenário: desfazer um pagamento
    Quando eu abro o evento como Lia
    E eu quito a primeira linha de Minha conta
    E eu começo a desfazer o pagamento "Lia → Fernando" e volto atrás
    Então o pagamento "Lia → Fernando" continua carimbado
    Quando eu toco duas vezes no carimbo do pagamento "Lia → Fernando"
    Então nenhum cartão abre
    Quando eu desfaço o pagamento "Lia → Fernando"
    Então nenhum pagamento está carimbado
    E falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 174,43 |
      | Lia       | Fernando | 117,84 |
      | Klinsmann | Fernando | 73,61  |
      | Klinsmann | Júlia    | 34,72  |
    E eu devo R$ 117,84 pro Fernando
    Quando eu abro o evento como Fernando em outro aparelho
    Então nenhum pagamento está carimbado
    E falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 174,43 |
      | Lia       | Fernando | 117,84 |
      | Klinsmann | Fernando | 73,61  |
      | Klinsmann | Júlia    | 34,72  |

  Cenário: quitar e avisar no zap
    Quando eu abro o evento como Lia
    E eu quito a primeira linha de Minha conta e aviso no zap
    Então o zap abre com a mensagem:
      """
      ✅ Fernando, te paguei R$ 117,84 do *bailedamada* 👍
      {site}/pago/?evento=bailedamada
      """

  Cenário: cobrar no zap quem me deve
    O link da cobrança já entra como quem deve: a pessoa abre e cai na própria conta.
    Quando eu abro o evento como Fernando
    E eu cobro a Mengla no zap
    Então o zap abre com a mensagem:
      """
      💅 Mengla, não tô cobrando, só lembrando: faltam R$ 174,43 pra Fernando no *bailedamada*

      {site}/fiado/?evento=bailedamada&quem=mengla
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

      tudo aqui 👉 {site}/fiado/?evento=bailedamada
      """

  Cenário: os botões dizem o que fazem
    Dado que o Fernando tem a chave pix "fernando@exemplo.com"
    Quando eu abro o evento como Lia
    Então os botões da minha linha são "✔ paguei" e "copiar pix"

  Cenário: no dedo o ✔ é fácil de acertar, no mouse não sobra área
    Quando eu abro o evento como Lia num celular
    Então a área de toque do ✔ tem pelo menos 44px
    Quando eu abro o evento como Lia
    Então a área do ✔ tem menos de 30px

  # o poll já baixa o evento: pagamento novo pra quem está vendo vira aviso, uma vez só
  Cenário: quem recebe vê o aviso quando alguém paga
    Quando eu abro o evento como Fernando
    E a Mengla paga R$ 174,43 pro Fernando em outro aparelho
    Então aparece o aviso "💸 Mengla te pagou R$ 174,43"
    Quando eu recarrego a página
    E o app sincroniza
    Então não aparece aviso de pagamento

  Cenário: dois pagamentos juntos viram um aviso só
    Quando eu abro o evento como Fernando
    E a Mengla e o Klinsmann pagam o que devem pro Fernando em outro aparelho
    Então aparece o aviso "💸 Mengla e Klinsmann te pagaram R$ 248,04"

  Cenário: o aviso também chega pra quem usa leitor de tela
    Quando eu abro o evento como Fernando
    E a Mengla paga R$ 174,43 pro Fernando em outro aparelho
    Então o leitor de tela anuncia "💸 Mengla te pagou R$ 174,43"

  Cenário: quem não recebeu não vê aviso
    Quando eu abro o evento como Lia
    E a Mengla paga R$ 174,43 pro Fernando em outro aparelho
    Então não aparece aviso de pagamento

  Cenário: quem recebe marca o que pagaram por fora
    Pagaram em dinheiro ou num pix fora daqui, e quem devia esqueceu do ✔: quem recebeu dá baixa.
    Quando eu abro o evento como Fernando
    E eu marco que recebi da Lia
    Então falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 174,43 |
      | Klinsmann | Fernando | 73,61  |
      | Klinsmann | Júlia    | 34,72  |
    E o pagamento "Lia → Fernando" está carimbado "PAGO" por Fernando

  # os R$ 3,61 que sobraram do Klinsmann: pouco demais pra cobrar; dívida grande não se perdoa, só se dá baixa
  Cenário: só dívida pequena se perdoa
    Dado que o Klinsmann já pagou R$ 70,00 pro Fernando
    Quando eu abro o evento como Fernando
    Então só o Klinsmann tem perdoar em Minha conta
    E os outros têm recebi
    Quando eu perdoo o Klinsmann
    Então falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 174,43 |
      | Lia       | Fernando | 117,84 |
      | Klinsmann | Júlia    | 34,72  |
    E o pagamento "Klinsmann → Fernando" está carimbado "PERDOADO"

  Cenário: desfazer um perdão
    Dado que o Klinsmann já pagou R$ 70,00 pro Fernando
    Quando eu abro o evento como Fernando
    E eu perdoo o Klinsmann
    E eu começo a desfazer o perdão "Klinsmann → Fernando"
    Então o cartão pergunta "Desfazer o perdão?"
    Quando eu confirmo
    Então o Klinsmann me deve R$ 3,61

  Cenário: quem devia fica sabendo do perdão
    Dado que o Klinsmann já pagou R$ 70,00 pro Fernando
    Quando eu abro o evento como Klinsmann
    E o Fernando perdoa os R$ 3,61 do Klinsmann em outro aparelho
    Então aparece o aviso "🙏 Fernando perdoou teus R$ 3,61"
