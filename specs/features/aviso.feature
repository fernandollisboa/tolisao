# language: pt
Funcionalidade: Aviso no celular quando me pagam
  Quem tem a receber liga o aviso em Minha conta, e daí cada pagamento marcado
  pra essa pessoa chega no celular dela, mesmo com o tô lisa fechado.
  Ninguém é perguntado sobre aviso ao abrir a página: só quem toca no 🔔.

  # o aviso chegando no celular (serviço de push → sw.js) não dá pra testar aqui:
  # os cenários param no que o app pede pra API. O resto se confere à mão, num celular
  Contexto:
    Dado o evento de exemplo "bailedamada"
    E que meu celular aceita aviso

  Cenário: quem tem a receber pode ligar o aviso no celular
    Quando eu abro o evento como Júlia
    Então Minha conta oferece "🔔 me avisa quando pagarem"

  Cenário: quem deve não tem aviso pra ligar
    Quando eu abro o evento como Lia
    Então Minha conta não oferece aviso no celular

  Cenário: ligar e desligar o aviso no celular
    Quando eu abro o evento como Júlia
    E eu ligo o aviso no celular
    Então Minha conta oferece "🔔 avisos ligados"
    E o celular fica inscrito pra receber o aviso da Júlia
    Quando eu desligo o aviso no celular
    Então Minha conta oferece "🔔 me avisa quando pagarem"
    E o celular deixa de receber o aviso da Júlia

  Cenário: marcar que paguei avisa o celular de quem recebeu
    Quando eu abro o evento como Lia
    E eu quito a primeira linha de Minha conta
    Então o Fernando é avisado no celular do pagamento da Lia
