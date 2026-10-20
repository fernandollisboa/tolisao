# language: pt
Funcionalidade: Aviso no celular quando me pagam ou anotam gasto comigo
  Quem liga o aviso em Minha conta fica sabendo no celular, mesmo com o tô lisa fechado,
  de cada pagamento marcado pra ela e de cada gasto novo que alguém anota com ela.
  Ninguém é perguntado sobre aviso ao abrir a página: só quem toca no 🔔.

  # o aviso chegando no celular (serviço de push → sw.js) não dá pra testar aqui:
  # os cenários param no que o app pede pra API. O resto se confere à mão, num celular
  Contexto:
    Dado o evento de exemplo "bailedamada"
    E que meu celular aceita aviso

  Cenário: quem tem a receber pode ligar o aviso no celular
    Quando eu abro o evento como Júlia
    Então Minha conta oferece "🔔 me avisa quando pagarem"

  Cenário: quem deve pode ligar o aviso dos gastos com ela
    Quando eu abro o evento como Lia
    Então Minha conta oferece "🔔 me avisa dos gastos comigo"

  Cenário: ligar o aviso no celular
    Ligado, o botão sai da frente: quem quiser desligar desliga nas notificações do navegador.
    Quando eu abro o evento como Júlia
    E eu ligo o aviso no celular
    Então o celular fica inscrito pra receber o aviso da Júlia
    E o botão do aviso sai de Minha conta

  Cenário: quem já ligou o aviso uma vez não é perguntado de novo
    O sim vale pro aparelho: nos outros eventos em que tenho a receber, o aviso já vem ligado.
    Dado que neste aparelho eu já liguei o aviso no celular
    Quando eu abro o evento como Júlia
    Então o celular fica inscrito pra receber o aviso da Júlia
    E o botão do aviso sai de Minha conta

  Cenário: marcar que paguei avisa o celular de quem recebeu
    Quando eu abro o evento como Lia
    E eu quito a primeira linha de Minha conta
    Então o Fernando é avisado no celular do pagamento da Lia

  Cenário: anotar um gasto avisa o celular de quem divide
    Quando eu abro o evento como Lia
    E eu anoto "Pizza" de R$ 60,00 dividido igualmente
    Então quem divide a "Pizza" é avisado no celular

  Cenário: editar um gasto não avisa de novo
    Avisa o gasto novo: corrigir a descrição não é motivo pra tocar o celular de ninguém.
    Quando eu abro o evento como Lia
    E eu abro a lista de itens
    E eu edito o "Uber volta"
    E eu mudo a descrição pra "Uber da volta" e salvo
    Então ninguém é avisado no celular

  Cenário: no iPhone sem o app instalado, o 🔔 ensina a instalar e a levar o link do evento
    No iPhone o aviso só chega com o tô lisa na Tela de Início, e quase ninguém sabe instalar pelo Safari.
    O app instalado abre sem o evento do Safari: é o link que leva até ele, e digitar o nome lá criaria outro.
    # o iPhone desfaz o "aceita aviso" do Contexto: no Safari, fora da Tela de Início, não tem aviso
    Dado que meu celular é um iPhone sem o tô lisa instalado
    Quando eu abro o evento como Júlia
    E eu ligo o aviso no celular
    Então aparece o passo a passo de instalar na Tela de Início
    Mas o celular não fica inscrito pra receber aviso
    Quando eu copio o link do evento pro app instalado
    Então fica copiado o link do evento que já entra como Júlia

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

  Cenário: o aviso do mêsversário da dívida abre já no cobrar
    Quem tem a receber é avisado quando a dívida de alguém faz 15 dias, e depois todo mês no mesmo dia.
    Tocar no aviso leva direto pra cobrança no zap, com o aniversário na mensagem.
    Dado que o último gasto foi anotado há 15 dias
    E que neste aparelho eu sou Fernando no "bailedamada"
    Quando eu toco no aviso de mêsversário da dívida da Mengla
    Então o cartão pergunta "Cobrar Mengla?"
    Quando eu cobro pelo cartão
    Então o zap abre com a mensagem:
      """
      💅 Mengla, não tô cobrando, só lembrando: faltam R$ 174,43 pra Fernando no *bailedamada*
      🎂 hoje a dívida completa 15 dias

      {site}/fiado/?evento=bailedamada&quem=mengla
      """

  Cenário: o aviso do mêsversário de uma dívida já paga só abre o evento
    Dado que a Mengla já pagou R$ 174,43 pro Fernando
    E que neste aparelho eu sou Fernando no "bailedamada"
    Quando eu toco no aviso de mêsversário da dívida da Mengla
    Então nenhum cartão abre
