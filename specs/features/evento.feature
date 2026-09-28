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
      *** MEUS EVENTOS ***
      BAILEDAMADA
      quite
      ✕
      sou Lia · 3 pessoas
      agora
      o ✕ tira da lista só neste aparelho
      + entrar em outro evento
      VOLTAR
      """
    Quando eu toco em voltar
    Então o cartão fecha
    Quando eu toco no meu nome
    Então o cartão de quem é você já vem com Lia escolhida
    E o cartão de quem é você não tem botão de sair

  Cenário: tocar no código do cartão do evento copia ele
    Dado o evento "bailedamada" com Fernando, Júlia e Lia
    Quando eu abro o evento como Lia
    E eu toco no nome do evento
    E eu toco no código do evento
    Então fica copiado "bailedamada"
    E aparece o aviso "Código copiado."

  Cenário: no caderno em branco, a caixa abre o anotar
    Dado o evento "churras" com Fernando, Júlia e Lia
    Quando eu abro o evento como Lia
    E eu toco na caixa do caderno em branco
    Então o formulário de anotar abre

  Cenário: evento novo começa pela lista de gente
    Dado que eu abro o site sem evento
    Quando eu digito o código "praia"
    E eu crio o evento
    E eu toco em quem é você
    Então o cartão mostra:
      """
      *** QUEM TÁ NO EVENTO? ***
      ninguém ainda
      ADICIONAR
      CONTINUAR
      SAIR
      """
    Quando eu ponho Fernando, Júlia e Lia na lista
    E eu tiro a Júlia da lista
    E eu tento pôr fernando na lista de novo
    Então aparece o aviso "Já existe alguém com esse nome"
    Quando eu continuo
    Então o site pergunta quem é você
    Quando eu escolho Lia
    Então o cabeçalho diz "sou Lia"
    E o evento no banco tem Fernando e Lia

  Cenário: evento de uma pessoa só não pergunta quem é você
    Dado que eu abro o site sem evento
    Quando eu digito o código "praia"
    E eu crio o evento
    E eu toco em quem é você
    E eu ponho Lia na lista
    E eu continuo
    Então o cabeçalho diz "sou Lia"

  Cenário: o evento sumiu do banco, e a cópia do aparelho traz ele de volta
    Dado o evento "churras" com Fernando, Júlia e Lia
    E os gastos:
      | o quê  | valor | pagou | divide entre         |
      | Carvão | 90,00 | Júlia | Fernando, Júlia, Lia |
    Quando eu abro o evento como Lia
    E o evento some do banco
    E eu abro o site de novo
    Então o cartão mostra:
      """
      EVENTO NÃO ENCONTRADO
      esse evento não está mais no banco
      RESTAURAR DA MINHA CÓPIA
      VOLTAR
      """
    Quando eu restauro da minha cópia
    Então o evento volta pro banco com o Carvão
    E o cabeçalho diz "sou Lia"

  Cenário: o evento sumiu do banco e eu desisto dele
    Ele sai da lista de eventos, mas a gaveta fica: é nela que mora a cópia.
    Dado o evento "churras" com Fernando, Júlia e Lia
    Quando eu abro o evento como Lia
    E o evento some do banco
    E eu abro o site de novo
    E eu desisto do evento
    Então aparece o cartão do código
    E o aparelho esquece o evento
