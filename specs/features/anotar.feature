# language: pt
Funcionalidade: Anotar um gasto
  O ✎ abre o formulário: valor, o quê, quem pagou e quem divide.
  Dá pra dividir igualmente ou em partes diferentes.

  # a mesma festa do acerto.feature, repetida de propósito: as contas daqui saem desta
  # tabela, e quem lê confere os números sem abrir outro arquivo
  # quem é e quanto gastou cada um está em specs/_festa.cjs, na forma desta tabela
  Contexto:
    Dado o evento de exemplo "bailedamada"

  Cenário: a lista de itens
    Quando eu abro o evento como Lia
    Então a lista tem 6 itens
    E o primeiro item da lista é "Uber volta" de 32,50
    E o "ver todos" não aparece, porque cabe tudo
    E o ✎ está chamando

  Cenário: ver quem divide um item
    Quando eu abro o evento como Lia
    E eu abro a lista de itens
    E eu toco no ÷ do "Uber volta"
    Então o "Uber volta" mostra quem divide: "÷4 (Lia, Mengla, Fernando, Júlia)"
    Quando eu toco no ÷ do "Uber volta"
    Então o "Uber volta" esconde quem divide

  Cenário: anotar pelo ✎ e o outro aparelho ver
    Quando eu abro o evento como Lia
    E eu anoto "Cerveja" de R$ 50,00 dividido igualmente
    Então o primeiro item da lista é "Cerveja" de 50,00
    E o ✎ continua chamando
    Quando eu abro o evento como Lia em outro aparelho
    Então o primeiro item da lista é "Cerveja" de 50,00

  # o sync baixa, mescla e grava a sala inteira: sem o if-match, a gravação passava por cima
  # do item que o outro aparelho gravou entre a baixada e a subida
  Cenário: outro aparelho grava no meio e os dois itens ficam
    Quando eu abro o evento como Lia
    E outro aparelho anota "Gelo" de R$ 20,00 bem na hora que eu gravo o "Cerveja"
    E eu anoto "Cerveja" de R$ 50,00 dividido igualmente
    Então o banco tem os itens "Cerveja" e "Gelo"

  Cenário: dividir em partes diferentes
    Quando eu abro o evento como Júlia
    E eu toco no ✎
    Então o formulário pede primeiro o valor e depois o quê
    Quando eu preencho R$ 42,84 de "Janta"
    E eu divido só entre Lia e Mengla, em partes diferentes
    E eu ponho R$ 18,87 pra Lia e R$ 20,00 pra Mengla
    Então o formulário diz que faltam R$ 3,97
    E ainda não dá pra anotar
    Quando eu ponho R$ 23,97 pra Mengla
    E eu salvo
    Então o primeiro item da lista é "Janta" de 42,84
    E embaixo dele está escrito "Júlia pagou · Lia 18,87, Mengla 23,97"
    E a lista fica separada em 2 dias
    E falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 198,40 |
      | Lia       | Fernando | 136,71 |
      | Klinsmann | Fernando | 30,77  |
      | Klinsmann | Júlia    | 77,56  |
    Quando eu abro o evento como Lia em outro aparelho
    Então eu devo R$ 136,71 pro Fernando
    E a minha linha no acerto é "Lia → Fernando"

  Cenário: o valor entra pelos centavos, como no app do banco
    Quando eu abro o evento como Lia
    E eu toco no ✎
    E eu digito no valor, tecla por tecla:
      | tecla | fica  |
      | 5     | 0,05  |
      | 0     | 0,50  |
      | 0     | 5,00  |
      | 0     | 50,00 |
    E eu apago o último dígito
    Então o valor fica "5,00"
    Quando eu digito "1234567" no valor
    Então o valor fica "5.001.234,56"

  Cenário: apagar um item deixa ele recolhido no fim, riscado e com quem apagou
    Quando eu abro o evento como Lia
    E eu abro a lista de itens
    E eu apago o "Uber ida"
    Então o fim da lista diz "▸ 1 item apagado"
    E nenhum item aparece riscado
    E o total dos itens fica 721,34
    Quando eu abro o evento como Fernando em outro aparelho
    E eu abro a lista de itens
    E eu abro os itens apagados
    Então o "Uber ida" aparece riscado, apagado por Lia

  Cenário: editar um item
    Quando eu abro o evento como Lia
    E eu abro a lista de itens
    E eu edito o "Uber volta"
    Então o formulário vem com R$ 32,50 de "Uber volta"
    Quando eu troco o valor pra R$ 40,00 e salvo
    Então o "Uber volta" fica de 40,00
    E nenhum item aparece riscado
    Quando eu abro o evento como Fernando em outro aparelho
    E eu abro a lista de itens
    Então o "Uber volta" fica de 40,00

  Cenário: excluir um item
    Quando eu abro o evento como Lia
    E eu abro a lista de itens
    E eu começo a excluir o "Uber volta" e volto atrás
    Então a lista tem 6 itens
    Quando eu excluo o "Uber volta"
    Então a lista tem 5 itens
    E o "Uber volta" não está na lista
    E falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 166,30 |
      | Lia       | Fernando | 142,21 |
      | Klinsmann | Fernando | 65,49  |
      | Klinsmann | Júlia    | 42,84  |
    Quando eu abro o evento como Fernando em outro aparelho
    Então a lista tem 5 itens

  Cenário: desistir da edição não suja o próximo anotar
    Quando eu abro o evento como Lia
    E eu abro a lista de itens
    E eu edito o "Uber volta"
    E eu fecho o anotar
    E eu toco no ✎
    Então o formulário vem vazio, pra anotar

  Cenário: Esc fecha o anotar e o teclado volta pro ✎
    Quando eu abro o evento como Lia
    E eu toco no ✎
    E eu aperto Esc
    Então o anotar fecha
    E o ✎ fica com o foco

  Cenário: editar um item de partes diferentes volta com as partes
    Quando eu abro o evento como Lia
    E eu toco no ✎
    E eu preencho R$ 42,84 de "Pizza"
    E eu divido só entre Lia e Mengla, em partes diferentes
    E eu ponho R$ 18,87 pra Lia e R$ 23,97 pra Mengla
    E eu salvo
    E eu edito o "Pizza"
    Então as partes ficam:
      | pessoa | parte |
      | Lia    | 18,87 |
      | Mengla | 23,97 |
    E o formulário diz que fechou

  Cenário: depois de anotar, o próximo gasto começa do zero
    Quando eu abro o evento como Lia
    E eu toco no ✎
    E eu preencho R$ 42,84 de "Janta"
    E eu divido só entre Lia e Mengla, em partes diferentes
    E eu ponho R$ 18,87 pra Lia
    E eu toco na aba igual
    E eu salvo
    E eu toco no ✎
    E eu toco na aba das partes diferentes
    Então todo mundo divide, com as partes vazias

  Cenário: a nota sincronizando não tira o campo de quem digita a parte
    Quando eu abro o evento como Lia
    E eu toco no ✎
    E eu preencho R$ 120,00 de "Airbnb"
    E eu toco na aba das partes diferentes
    E eu começo a digitar a parte do Fernando
    E a nota sincroniza
    Então o cursor continua na parte do Fernando

  Cenário: as ajudas de conta das partes diferentes
    Quando eu abro o evento como Lia
    E eu toco no ✎
    E eu preencho R$ 120,00 de "Airbnb"
    Então a frase de como está dividido vem antes das abas
    Quando eu toco na aba das partes diferentes
    Então a aba das partes diferentes fica marcada
    E os chips de quem divide somem
    Quando eu ponho R$ 40,00 pra Fernando
    Então o formulário diz que faltam R$ 80,00
    E ainda não dá pra anotar
    Quando eu toco em "dividir o resto igual"
    Então as partes ficam:
      | pessoa    | parte |
      | Fernando  | 40,00 |
      | Júlia     | 20,00 |
      | Lia       | 20,00 |
      | Mengla    | 20,00 |
      | Klinsmann | 20,00 |
    E já dá pra anotar
    Quando eu tiro o Klinsmann da divisão
    Então o Klinsmann sai também dos chips de quem divide
    E o formulário diz que faltam R$ 20,00
    Quando eu apago a parte da Júlia e toco em "o resto" nela
    Então a parte da Júlia fica "40,00"
    E o formulário diz que fechou

  Regra: o item é de quem anotou, mesmo depois de trocar de nome
    Só quem anotou edita e exclui o item. Trocar de nome no Quem vai? não tira isso de ninguém,
    e quem chega depois com o nome antigo não ganha os itens de outra pessoa.

    Exemplo: quem trocou de nome continua dona do que anotou
      Dado que a Lia anotou o "Gasolina ida"
      E que a Lia trocou o nome pra Liazinha
      Quando eu abro o evento como Liazinha
      E eu abro a lista de itens
      Então o "Gasolina ida" diz que foi anotado por Liazinha
      E eu posso editar e excluir o "Gasolina ida"
      Quando eu edito o "Gasolina ida"
      E eu troco o valor pra R$ 140,00 e salvo
      Então o "Gasolina ida" fica de 140,00

    Exemplo: quem chega com o nome antigo não ganha os itens de ninguém
      Dado que a Lia anotou o "Gasolina ida"
      E que a Lia trocou o nome pra Liazinha
      E que entrou na turma outra Lia
      Quando eu abro o evento como Lia
      E eu abro a lista de itens
      Então eu não posso editar nem excluir o "Gasolina ida"
      E o "Gasolina ida" diz que foi anotado por Liazinha
