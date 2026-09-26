# language: pt
Funcionalidade: Entrar no evento
  O evento é o código combinado no zap. Quem tem o código entra, e ninguém
  consegue listar os eventos que existem no banco.

  Cenário: errar o código e voltar
    Dado que eu abro o site sem evento
    Quando eu digito o código "bailedamda"
    Então o site pergunta se é um evento novo
    Quando eu volto
    Então o cartão do código volta com "bailedamda" escrito
    E aparece o recado "confira o código"

  Cenário: tocar fora também volta pro código
    Dado que eu abro o site sem evento
    Quando eu digito o código "bailedamda"
    Então o site pergunta se é um evento novo
    Quando eu toco fora do cartão
    Então o cartão do código volta com "bailedamda" escrito

  Cenário: o código fica no endereço, com um final sorteado
    Código curto se adivinha testando direto no banco. O evento novo ganha um
    final sorteado no link, e a tela continua com o nome que a pessoa digitou.
    Dado que eu abro o site sem evento
    Quando eu digito o código "Bailedamada"
    E eu crio o evento
    Então o endereço é "?senha=bailedamada-" com um final sorteado
    E o nome do evento no cabeçalho é "bailedamada"
    Quando eu recarrego a página
    Então o site não pergunta nada
    Quando eu colo o link "?senha=bailedamada" na mesma aba
    Então o site pergunta se é um evento novo

  Cenário: evento que já existe abre pelo código de sempre
    Dado o evento "churras" com Fernando, Júlia e Lia
    E que eu abro o site sem evento
    Quando eu digito o código "churras"
    Então o site não pergunta nada
    E o endereço termina em "?senha=churras"
    E o nome do evento no cabeçalho é "churras"

  Cenário: o cartão do evento
    Dado o evento "bailedamada" com Fernando, Júlia e Lia
    Quando eu abro o evento como Lia
    E eu toco no nome do evento
    Então o cartão mostra:
      """
      *** EVENTO ***
      CÓDIGO
      bailedamada
      ENTRA QUEM TEM
      a senha
      VOLTAR
      SAIR DO EVENTO
      """
    E o botão de sair do evento é vermelho
    Quando eu toco em voltar
    Então o cartão fecha
    Quando eu toco no meu nome
    Então o cartão de quem é você não tem botão de sair

  Cenário: chegar mais gente pela lista do rodapé
    Dado o evento "bailedamada" com Fernando, Júlia, Lia, Mengla e Klinsmann
    Quando eu abro o evento como Lia
    E eu adiciono "Zé" pela lista de gente do rodapé
    Então a lista de gente fica "Fernando, Júlia, Lia, Mengla, Klinsmann, Zé"

  Cenário: no caderno em branco, a caixa abre o anotar
    Dado o evento "churras" com Fernando, Júlia e Lia
    Quando eu abro o evento como Lia
    E eu toco na caixa do caderno em branco
    Então o formulário de anotar abre
