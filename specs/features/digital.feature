# language: pt
Funcionalidade: Entrar com a digital
  Quem guarda os eventos na digital acha eles de volta em outro celular, ou depois de
  limpar o navegador, sem senha nem cadastro: o celular só pede a digital (passkey).
  Por enquanto é protótipo: só aparece no aparelho de quem pediu pra testar.

  # a digital é um autenticador virtual do Chromium. O celular novo ganha a mesma passkey,
  # como o iCloud e o Google sincronizam entre os aparelhos da mesma pessoa
  Contexto:
    Dado o evento "churras" com Fernando, Júlia e Lia
    E os gastos:
      | o quê  | valor | pagou | divide entre         |
      | Carvão | 90,00 | Júlia | Fernando, Júlia, Lia |
    E que meu celular tem digital

  Cenário: os eventos guardados na digital voltam num celular novo, comigo dentro
    Dado que eu pedi pra testar a digital
    E que neste aparelho eu sou Lia no "churras"
    Quando eu abro o tô lisa
    E eu guardo meus eventos na digital
    Então aparece o aviso "Guardei 1 evento na digital. Noutro celular, é só entrar com ela."
    Quando eu entro com a digital num celular novo
    Então aparece o aviso "Voltou 1 evento 🫰"
    E o "churras" volta pra lista, comigo como Lia
    E o saldo do "churras" na lista é "R$ 30,00"

  Cenário: quem usa teclado também guarda na digital
    Dado que eu pedi pra testar a digital
    E que neste aparelho eu sou Lia no "churras"
    Quando eu abro o tô lisa
    E eu guardo meus eventos na digital pelo teclado
    Então aparece o aviso "Guardei 1 evento na digital. Noutro celular, é só entrar com ela."

  Cenário: a digital só aparece pra quem pediu, e o aparelho lembra
    Quando eu abro o tô lisa
    Então o cartão não oferece a digital
    Quando eu abro o tô lisa pelo endereço de testar a digital
    E eu abro o tô lisa
    Então o cartão oferece "entrar com a digital"

  Regra: a chave pix cadastrada com a digital volta com a digital
    Limpou o navegador, a chave ficava presa no aparelho de antes e ninguém mais trocava.
    Com a digital, ela continua de quem cadastrou.

    Contexto:
      Dado que eu pedi pra testar a digital

    Exemplo: limpei o navegador e ainda troco a minha chave
      Quando eu abro o evento como Júlia
      E eu cadastro a chave pix "julia@exemplo.com"
      E eu limpo o navegador e volto ao evento como Júlia
      E eu libero a minha chave com a digital
      E eu toco em trocar a chave pix
      E eu troco a chave por "julia@novo.com"
      Então o banco guarda a chave da Júlia "julia@novo.com"

    Exemplo: a digital de outra pessoa não libera a chave
      Dado que o Fernando já cadastrou a chave pix "fernando@exemplo.com" em outro aparelho
      Quando eu abro o evento como Júlia
      E eu cadastro a chave pix "julia@exemplo.com"
      E eu troco pra Fernando
      E eu libero a minha chave com a digital
      Então aparece o aviso "Essa digital não cadastrou essa chave"
