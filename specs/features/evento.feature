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
    E aparece o recado "nada foi criado."

  Cenário: link de evento que não existe não oferece criar como se fosse nome novo
    Código com o final sorteado é de um link: se não abre nada, o link veio errado ou o evento sumiu.
    Dado que eu abro o site sem evento
    Quando eu digito o código "churras-k7f3q9"
    Então o cartão pergunta 'Não achei "churras-k7f3q9"'

  Cenário: tocar fora também volta pro código
    Dado que eu abro o site sem evento
    Quando eu digito o código "bailedamda"
    Então o site pergunta se é um evento novo
    Quando eu toco fora do cartão
    Então o cartão do código volta com "bailedamda" escrito

  Cenário: Esc fecha o cartão, como tocar fora
    No computador, Esc é o gesto que todo mundo tenta pra fechar.
    Dado o evento "bailedamada" com Fernando, Júlia e Lia
    Quando eu abro o evento como Lia
    E eu toco no nome do evento
    E eu aperto Esc
    Então o cartão fecha

  Cenário: sem evento, o Esc não some com o cartão do código
    Dado que eu abro o site sem evento
    Quando eu aperto Esc
    Então aparece o cartão do código

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

  Cenário: colar o link do zap no campo abre o evento
    O que a pessoa tem no zap é o link, não o código. Colado no campo, sozinho ou com a
    mensagem inteira, ele abre o evento e diz quem é, como se ela tivesse tocado nele.
    Dado o evento "churras" com Fernando, Júlia e Lia
    E que eu abro o site sem evento
    Quando eu colo no campo do código:
      """
      Lia, faltam R$ 30,00 do *churras* 💸
      https://tolisa.com.br/fiado/?evento=churras&quem=lia
      """
    Então o cabeçalho diz "sou Lia"
    E o nome do evento no cabeçalho é "churras"
    E o endereço termina em "?evento=churras"

  Cenário: o nome de um evento da lista abre ele, sem criar outro igual
    O link do evento ganha um final sorteado, mas o que a pessoa lembra é o nome.
    Dado que este aparelho já abriu o evento "praia" pelo link "praia-k7f3q9"
    E que eu abro o site sem evento
    Quando eu digito o código "praia"
    Então o endereço termina em "?evento=praia-k7f3q9"
    E o nome do evento no cabeçalho é "praia"

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
    E a nota não pergunta quem eu sou
    E o endereço termina em "?evento=churras"

  Cenário: na mesa, a turma escaneia o QR e cai no evento
    A turma tá do lado: em vez de passar o link pelo zap, quem tá com o celular mostra o QR.
    O QR abre o evento direto, sem passar pela página do preview do zap: na rede do bar, é um salto a menos.
    Dado o evento de exemplo "bailedamada"
    Quando eu abro o evento como Fernando
    E eu peço o QR do evento
    Então o QR na tela abre o evento direto

  Cenário: o evento que acabou de nascer, só comigo, já mostra o QR
    É logo na criação que a turma da mesa precisa entrar, antes de qualquer gasto.
    Enquanto o QR tá aberto, a tela não apaga na cara de quem aponta a câmera.
    Dado o evento "praia" com Lia
    E que meu celular deixa o site manter a tela acesa
    Quando eu abro o evento como Lia
    E eu toco no nome do evento
    E eu peço o QR no cartão do evento
    Então o QR na tela abre o evento direto
    E a tela fica acesa
    Quando eu fecho o QR
    Então a tela já pode apagar

  Cenário: quem chega pelo link do grupo diz quem é na própria nota
    O link do grupo não diz quem abriu. A nota já mostra a turma no topo, um nome
    por pessoa, sem cartão na frente: ninguém é interrompido na chegada.
    Dado o evento de exemplo "bailedamada"
    Quando eu abro o link do grupo
    Então nenhum cartão abre
    E a nota pergunta quem eu sou entre Fernando, Júlia, Lia, Mengla e Klinsmann
    Quando eu toco no meu nome, Lia, no topo da nota
    Então o cabeçalho diz "sou Lia"
    E Minha conta diz "eu devo" R$ 117,84
    E a nota não pergunta quem eu sou

  Cenário: quem chega e não está na turma se põe na lista
    Dado o evento "churras" com Fernando, Júlia e Lia
    Quando eu abro o link do grupo
    E eu digo que não tô na turma
    E eu ponho Bia na lista
    E eu continuo
    E eu escolho Bia
    Então o cabeçalho diz "sou Bia"
    E o evento no banco tem Fernando, Júlia, Lia e Bia

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

  Cenário: o cartão do evento é a tela inicial, com o evento aberto marcado
    Quem entra é quem tem o link: o cartão não mostra código, só copia o link.
    Dado o evento "bailedamada" com Fernando, Júlia e Lia
    Quando eu abro o evento como Lia
    E eu toco no nome do evento
    Então o cartão mostra:
      """
      TÔ LISA
      *** EVENTO ***
      ENTRA QUEM TEM
      QR
      o link
      *** MEUS EVENTOS ***
      BAILEDAMADA
      quite
      ✕
      sou Lia · 3 pessoas
      agora
      o ✕ tira da lista só neste aparelho
      *** OUTRO EVENTO ***
      ENTRAR
      VOLTAR
      """
    Quando eu toco em voltar
    Então o cartão fecha
    Quando eu toco no meu nome
    Então o cartão de quem é você já vem com Lia escolhida
    E o cartão de quem é você não tem botão de sair

  Cenário: o cartão do evento copia o link, não o código
    Dado o evento "bailedamada" com Fernando, Júlia e Lia
    Quando eu abro o evento como Lia
    E eu toco no nome do evento
    E eu toco no link do cartão do evento
    Então fica copiado o link do evento

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
      um nome por vez, enter pro próximo
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
      um nome por vez, enter pro próximo
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

  Cenário: outra pessoa no quem é você abre a lista de gente, sem trocar quem eu sou
    Quem apertou Pronto cedo demais põe o resto da turma depois, de uma vez.
    Dado o evento "churras" com Fernando, Júlia e Lia
    E os gastos:
      | o quê | valor | pagou    | divide entre    |
      | Pizza | 60,00 | Fernando | Fernando, Júlia |
    Quando eu abro o evento como Fernando
    E eu toco em quem é você
    E eu escolho outra pessoa
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
      SUMIU!
      esse evento não tá mais aqui, mas teu celular guardou uma cópia.
      TRAZER DE VOLTA
      VOLTAR
      """
    Quando eu trago o evento de volta da minha cópia
    Então o evento volta pro banco com o Carvão
    E o cabeçalho diz "sou Lia"

  Cenário: a rede engasgada vira offline, e a nota tenta de novo
    No bar o 3G para sem dar erro: a nota avisa que tá offline em vez de fingir que sincronizou,
    e o que foi anotado sobe quando a rede volta.
    Dado o evento "churras" com Fernando, Júlia e Lia
    Quando eu abro o evento como Lia
    E a rede engasga e o banco para de responder
    Então o rodapé diz "Offline · a rede não respondeu"
    Quando a rede volta
    Então o rodapé diz que sincronizou

  Cenário: o evento sumiu do banco e eu desisto dele
    Ele sai da lista de eventos, mas a gaveta fica: é nela que mora a cópia.
    Dado o evento "churras" com Fernando, Júlia e Lia
    Quando eu abro o evento como Lia
    E o evento some do banco
    E eu abro o site de novo
    E eu desisto do evento
    Então aparece o cartão do código
    E o aparelho esquece o evento
