# language: pt
Funcionalidade: Instalar o tô lisa na tela de início
  Instalado, o tô lisa abre direto do ícone, e é assim que o aviso de pagamento chega no iPhone.
  O botão de instalar fica no topo da nota, embaixo do subtítulo, pra quem pode instalar.

  Contexto:
    Dado o evento de exemplo "bailedamada"

  Cenário: no Android, o instalar do topo chama o convite do navegador
    Dado que meu navegador oferece instalar o tô lisa
    Quando eu abro o evento como Lia
    E eu toco em instalar, no topo da nota
    Então o navegador me convida a instalar o tô lisa

  Cenário: no iPhone, o instalar do topo ensina o caminho do Safari
    O iPhone não tem convite do navegador: só se instala pelo Compartilhar do Safari.
    Dado que meu celular é um iPhone sem o tô lisa instalado
    Quando eu abro o evento como Lia
    E eu toco em instalar, no topo da nota
    Então aparece o passo a passo do Safari

  Cenário: com o tô lisa já instalado, não tem botão de instalar
    Dado que meu celular é um iPhone com o tô lisa instalado
    Quando eu abro o evento como Lia
    Então a nota não oferece instalar

  Cenário: navegador que não instala não mostra o botão
    Quando eu abro o evento como Lia
    Então a nota não oferece instalar
