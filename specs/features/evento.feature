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
    Então o endereço é "?evento=bailedamada-" com um final sorteado
    E o nome do evento no cabeçalho é "bailedamada"
    Quando eu recarrego a página
    Então o site não pergunta nada
    Quando eu colo o link "?evento=bailedamada" na mesma aba
    Então o site pergunta se é um evento novo

  Cenário: evento que já existe abre pelo código de sempre
    Dado o evento "churras" com Fernando, Júlia e Lia
    E que eu abro o site sem evento
    Quando eu digito o código "churras"
    Então o site não pergunta nada
    E o endereço termina em "?evento=churras"
    E o nome do evento no cabeçalho é "churras"

  Cenário: o link pode dizer quem vai abrir
    Dado o evento "churras" com Fernando, Júlia e Lia
    E os gastos:
      | o quê | valor | pagou    | divide entre          |
      | Pizza | 90,00 | Fernando | Fernando, Júlia, Lia |
    Quando eu abro o evento como Fernando
    E eu toco em enviar pra Lia
    Então o link do zap entra como Lia
    Quando eu abro o link do zap em outro aparelho
    Então o cabeçalho diz "sou Lia"
    E o endereço termina em "?evento=churras"

  Cenário: o quem do link não troca quem o aparelho já é
    Dado o evento "churras" com Fernando, Júlia e Lia
    Quando eu abro o evento como Fernando
    E eu colo o link do evento pra Lia na mesma aba
    Então o cabeçalho diz "sou Fernando"

  Cenário: link antigo, com ?senha=, continua abrindo
    Dado o evento "churras" com Fernando, Júlia e Lia
    Quando eu abro o endereço "?senha=churras"
    Então o nome do evento no cabeçalho é "churras"
    E o endereço termina em "?evento=churras"

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
    Então o cartão mostra:
      """
      Quem vai?
      enter pula pra próxima
      +
      + OUTRA PESSOA
      PRONTO
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

  Cenário: fechar a lista de gente volta pra nota, e o quem é você abre ela de novo
    Dado que eu abro o site sem evento
    Quando eu digito o código "praia"
    E eu crio o evento
    E eu toco fora do cartão
    Então o cartão fecha
    Quando eu toco em quem é você
    Então o cartão mostra:
      """
      Quem vai?
      enter pula pra próxima
      +
      + OUTRA PESSOA
      PRONTO
      SAIR
      """

  Cenário: tocar no nome deixa corrigir sem apagar a pessoa
    Dado que eu abro o site sem evento
    Quando eu digito o código "praia"
    E eu crio o evento
    E eu ponho Fernando e Julai na lista
    E eu troco o nome da Julai pra Júlia na lista
    E eu troco o nome do Fernando pra Júlia na lista
    Então aparece o aviso "Já existe alguém com esse nome"
    E o evento no banco tem Fernando e Júlia

  Cenário: o nome que ficou na caixa entra no pronto
    Dado que eu abro o site sem evento
    Quando eu digito o código "praia"
    E eu crio o evento
    E eu ponho Fernando na lista
    E eu escrevo Lia e aperto pronto sem dar enter
    Então o site pergunta quem é você
    E o evento no banco tem Fernando e Lia

  Cenário: faltou gente: dá pra pôr mais pessoas depois, sem virar elas
    Dado o evento "churras" com Fernando, Júlia e Lia
    E os gastos:
      | o quê | valor | pagou    | divide entre    |
      | Pizza | 60,00 | Fernando | Fernando, Júlia |
    Quando eu abro o evento como Fernando
    E eu toco em quem é você
    E eu toco em faltou gente
    Então só a Lia tem ✕ na lista
    Quando eu ponho Mel e Rui na lista
    E eu continuo
    Então o cabeçalho diz "sou Fernando"
    E o evento no banco tem Fernando, Júlia, Lia, Mel e Rui

  Cenário: ninguém divide cor, por maior que seja a turma
    Cada pessoa é reconhecida pela cor dela na nota inteira: duas iguais confundem quem deve a quem.
    Dado um evento com uma turma grande
    Quando eu abro o Quem vai?
    Então ninguém tem a mesma cor

  Cenário: evento de uma pessoa só não pergunta quem é você
    Dado que eu abro o site sem evento
    Quando eu digito o código "praia"
    E eu crio o evento
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
