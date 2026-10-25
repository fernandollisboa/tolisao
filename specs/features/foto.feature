# language: pt
Funcionalidade: Foto da conta
  No bar, a conta chega impressa. Em vez de somar de cabeça o que entra no gasto, a pessoa
  fotografa a conta e toca nos preços: a soma vai pro valor do anotar.
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

  Regra: pra quem pediu pra testar, os preços tocados na foto somam no valor do anotar

    Contexto:
      Dado que eu pedi pra testar o modo mesa

    Exemplo: a soma do que eu toquei vai pro valor
      Dado uma conta em que se lê 12,90, 39,90 e 22,00
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu fotografo a conta
      E eu toco em 12,90 e 39,90 na foto
      E eu uso a soma da foto
      Então o valor do anotar é 52,80

    Exemplo: tocar de novo num preço tira ele da soma
      Dado uma conta em que se lê 12,90, 39,90 e 22,00
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu fotografo a conta
      E eu toco em 12,90, 39,90 e 12,90 na foto
      Então a foto soma R$ 39,90

    Exemplo: o item da conta de restaurante vale a quantidade vezes o unitário
      A impressora térmica corta o último dígito do total na beirada do papel: o total sai do "6 UND x 18,90".
      Dado uma conta com o item "BUDWEISER 600ML" e a linha "6 UND x 18,90 113,4("
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu fotografo a conta
      E eu toco no item "BUDWEISER 600ML" na foto
      Então a foto soma R$ 113,40

    Exemplo: a foto em que não se lê preço avisa
      Dado uma conta em que não se lê preço nenhum
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu fotografo a conta
      Então a foto diz "não achei preço nessa foto"
