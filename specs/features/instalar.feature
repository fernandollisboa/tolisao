# language: pt
Funcionalidade: Convite de instalar pra quem chega pelo QR
  Quem escaneia o QR na mesa tá com o celular na mão e acabou de entrar na conta: é a hora de
  lembrar que dá pra pôr o tô lisa na tela de início. Ninguém é interrompido na chegada: o convite
  só aparece depois de a pessoa dizer quem é, discreto no topo da nota, e uma vez só por aparelho.

  Contexto:
    Dado o evento de exemplo "bailedamada"

  Cenário: quem escaneia o QR, depois de dizer quem é, ganha o convite de instalar
    A marca do QR some do endereço assim que a página abre: quem copiar a barra manda o link de sempre.
    Dado que meu navegador oferece instalar o tô lisa
    Quando eu abro o evento pelo QR
    Então nenhum cartão abre
    E a nota não me convida a instalar o tô lisa
    E o endereço termina em "?evento=bailedamada"
    Quando eu toco no meu nome, Lia, no topo da nota
    Então a nota me convida: "📲 instala pra ser avisado quando te pagarem"
    Quando eu aceito o convite de instalar
    Então o navegador me convida a instalar o tô lisa
    E a nota não me convida a instalar o tô lisa

  Cenário: no iPhone, o convite ensina a instalar pelo Safari
    Instalado, o tô lisa abre sem nada: o passo a passo lembra em qual evento entrar.
    Dado que meu celular é um iPhone sem o tô lisa instalado
    Quando eu abro o evento pelo QR
    E eu toco no meu nome, Lia, no topo da nota
    E eu aceito o convite de instalar
    Então aparece o passo a passo do Safari, lembrando de entrar de novo no evento

  Cenário: "agora não" tira o convite da frente
    Dado que meu navegador oferece instalar o tô lisa
    Quando eu abro o evento pelo QR
    E eu toco no meu nome, Lia, no topo da nota
    E eu dispenso o convite de instalar
    Então a nota não me convida a instalar o tô lisa
    Mas o navegador não me convida a instalar o tô lisa

  Cenário: o convite é um só por aparelho
    Dado que este aparelho já ganhou o convite de instalar pelo QR
    E que meu navegador oferece instalar o tô lisa
    Quando eu abro o evento pelo QR
    E eu toco no meu nome, Lia, no topo da nota
    Então a nota não me convida a instalar o tô lisa

  Cenário: com o tô lisa já instalado, ninguém é convidado
    Dado que meu celular é um iPhone com o tô lisa instalado
    Quando eu abro o evento pelo QR
    E eu toco no meu nome, Lia, no topo da nota
    Então a nota não me convida a instalar o tô lisa

  Cenário: quem chega pelo link do zap não é convidado
    O convite é da mesa: o link do zap chega até pra quem nem tá no rolê.
    Dado que meu navegador oferece instalar o tô lisa
    Quando eu abro o link do grupo
    E eu toco no meu nome, Lia, no topo da nota
    Então a nota não me convida a instalar o tô lisa
