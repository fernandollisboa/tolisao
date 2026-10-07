# language: pt
Funcionalidade: A mesma turma em outro evento
  Quem racha sempre com a mesma gente não digita todo mundo de novo: o evento
  novo traz a turma de um evento meu, e as pessoas continuam sendo as mesmas.
  Assim o aparelho também sabe dizer quem eu sou num evento que eu ainda não abri.

  Contexto:
    Dado o evento "churras" com Fernando, Júlia e Lia
    E os gastos:
      | o quê  | valor | pagou | divide entre         |
      | Carvão | 90,00 | Júlia | Fernando, Júlia, Lia |

  Regra: o evento novo traz a turma de um evento meu

    Exemplo: as mesmas pessoas, menos quem não vai, e nenhum gasto
      Dado que neste aparelho eu sou Lia no "churras"
      E que eu abro o site sem evento
      Quando eu crio o evento "praia"
      E eu trago a turma do "churras" sem o Fernando
      E eu continuo
      Então o cabeçalho diz "sou Lia"
      E o evento no banco tem Júlia e Lia
      E Júlia e Lia são as mesmas pessoas do "churras"
      E o evento novo não tem nenhum gasto

    Exemplo: a minha chave pix vem junto, a dos outros não
      A chave dos outros ficaria presa neste aparelho: só quem cadastra troca.
      Dado que neste aparelho eu sou Lia no "churras"
      E a Júlia tem a chave pix "julia@exemplo.com"
      E que eu já usei a chave pix "lia@exemplo.com" em outro evento
      E que eu abro o site sem evento
      Quando eu crio o evento "praia"
      E eu trago a turma do "churras"
      Então o evento novo guarda a chave pix da Lia "lia@exemplo.com"
      E o segredo da chave da Lia no evento novo é só deste evento
      Mas o evento novo não tem a chave pix da Júlia

    Exemplo: outro evento com o nome de um da lista
      O nome de um evento da lista abre ele. Quem faz churras todo mês cria o próximo pelo cartão do evento.
      Dado que neste aparelho eu sou Lia no "churras"
      Quando eu abro o evento "churras"
      E eu toco no nome do evento
      E eu crio outro "churras"
      Então o endereço é "?evento=churras-" com um final sorteado
      E o nome do evento no cabeçalho é "churras"
      Quando eu trago a turma do "churras"
      E eu continuo
      Então o cabeçalho diz "sou Lia"
      E Fernando, Júlia e Lia são as mesmas pessoas do "churras"
      E o evento novo não tem nenhum gasto

  Cenário: a minha chave de sempre já vem escrita no cadastro
    Dado que eu já usei a chave pix "julia@exemplo.com" em outro evento
    Quando eu abro o evento como Júlia
    E eu toco em cadastrar chave pix
    Então a caixa da chave já vem com "julia@exemplo.com"

  Regra: quem abre sem dizer quem é ganha um palpite, nunca uma escolha feita
    Ninguém é interrompido na chegada: o palpite fica no cabeçalho, a um toque.

    Exemplo: a pessoa que eu já sou na turma de outro evento
      Dado que neste aparelho eu sou Lia no "churras"
      E o evento "praia" com Lia e Mengla
      Quando eu abro o evento "praia"
      Então o cabeçalho pergunta "você é Lia?"
      E nenhum cartão abre
      Quando eu respondo que sim
      Então o cabeçalho diz "sou Lia"

    Exemplo: sem a turma, o nome que escolhi da última vez
      Dado que da última vez, em outro evento, eu fui "Lia"
      Quando eu abro o evento "churras"
      Então o cabeçalho pergunta "você é Lia?"
      Quando eu respondo que não
      Então o site pergunta quem é você

    Exemplo: sou duas pessoas da turma, então nada de palpite
      Dado que neste aparelho eu sou Lia no "churras"
      E o evento "praia" com Lia e Mengla
      E que neste aparelho eu sou Mengla no "praia"
      E o evento "show" com Lia, Mengla e Caio
      Quando eu abro o evento "show"
      Então o cabeçalho pergunta "Quem é você?"
