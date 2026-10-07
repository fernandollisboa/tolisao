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

  Cenário: ligar o aviso no celular
    Ligado, o botão sai da frente: quem quiser desligar desliga nas notificações do navegador.
    Quando eu abro o evento como Júlia
    E eu ligo o aviso no celular
    Então o celular fica inscrito pra receber o aviso da Júlia
    E o botão do aviso sai de Minha conta

  Cenário: marcar que paguei avisa o celular de quem recebeu
    Quando eu abro o evento como Lia
    E eu quito a primeira linha de Minha conta
    Então o Fernando é avisado no celular do pagamento da Lia

  Cenário: no iPhone sem o app instalado, o 🔔 ensina a instalar
    No iPhone o aviso só chega com o tô lisa na Tela de Início, e quase ninguém sabe instalar pelo Safari.
    # o iPhone desfaz o "aceita aviso" do Contexto: no Safari, fora da Tela de Início, não tem aviso
    Dado que meu celular é um iPhone sem o tô lisa instalado
    Quando eu abro o evento como Júlia
    E eu ligo o aviso no celular
    Então aparece o passo a passo de instalar na Tela de Início
    Mas o celular não fica inscrito pra receber aviso

  Cenário: no navegador do Instagram, o 🔔 manda abrir no Safari
    O navegador de dentro do Instagram e do Facebook não põe o tô lisa na Tela de Início.
    Dado que meu celular é um iPhone com o link aberto no Instagram
    Quando eu abro o evento como Júlia
    E eu ligo o aviso no celular
    E eu copio o link pro Safari
    Então fica copiado o link do evento que já entra como Júlia
    Mas não aparece o passo a passo do Safari

  Cenário: ligar o aviso convida a instalar, quando o navegador deixa
    Instalado, o aviso abre o tô lisa direto. Recusar o convite não impede o aviso.
    Dado que meu navegador oferece instalar o tô lisa
    Quando eu abro o evento como Júlia
    E eu ligo o aviso no celular
    Então o navegador me convida a instalar o tô lisa
    E o celular fica inscrito pra receber o aviso da Júlia
