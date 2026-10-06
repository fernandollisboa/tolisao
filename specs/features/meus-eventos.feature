# language: pt
Funcionalidade: Meus eventos
  O aparelho lembra dos eventos em que você entrou, com o seu saldo em cada um,
  contado da cópia guardada. Não tem "sair": o evento só sai da lista pelo ✕,
  e só deste aparelho. O banco continua sem deixar listar nada.

  Contexto:
    Dado o evento "churras" com Fernando, Júlia e Lia
    E os gastos:
      | o quê  | valor | pagou | divide entre         |
      | Carvão | 90,00 | Júlia | Fernando, Júlia, Lia |
    E o evento "praia" com Lia e Mengla
    E os gastos:
      | o quê | valor  | pagou | divide entre |
      | Casa  | 200,00 | Lia   | Lia, Mengla  |

  Cenário: a lista vem pela última mudança no evento, e só abrir não sobe ele
    Dado que o "churras" mudou pela última vez há 3 dias
    E que o "praia" mudou pela última vez há 10 dias
    Quando eu abro o evento "churras" como Lia
    E eu entro no evento "praia" como Lia
    E eu toco no nome do evento
    Então a lista de eventos é:
      | churras | há 3 dias   |
      | praia   | há 1 semana |

  Cenário: a data da lista vem do banco, mesmo do que mudou em outro aparelho
    Dado que o "churras" mudou pela última vez há 3 dias
    E que o "praia" mudou pela última vez há 10 dias
    Quando eu abro o evento "churras" como Lia
    E eu entro no evento "praia" como Lia
    E alguém mexe no "churras" ontem, em outro aparelho
    E eu toco no nome do evento
    Então a lista de eventos é:
      | churras | ontem       |
      | praia   | há 1 semana |

  Cenário: os eventos em que entrei ficam no cartão do evento, com o meu saldo
    Quando eu abro o evento "churras" como Lia
    E eu entro no evento "praia" como Lia
    E eu toco no nome do evento
    Então o cartão mostra:
      """
      *** EVENTO ***
      CÓDIGO
      praia
      ENTRA QUEM TEM
      a senha
      *** MEUS EVENTOS ***
      no total: te devem R$ 70,00
      PRAIA
      R$ 100,00
      ✕
      sou Lia · 2 pessoas
      agora
      CHURRAS
      R$ 30,00
      ✕
      sou Lia · 3 pessoas
      agora
      o ✕ tira da lista só neste aparelho
      + entrar em outro evento
      VOLTAR
      """
    E o saldo do "praia" é verde
    E o saldo do "churras" é vermelho
    Quando eu toco no "churras" da lista
    Então o endereço termina em "?evento=churras"
    E o cabeçalho diz "sou Lia"

  Cenário: o endereço sem código é a lista de eventos
    Quando eu abro o evento "churras" como Lia
    E eu toco no nome do evento
    E eu toco em entrar em outro evento
    Então o cartão mostra:
      """
      TÔ LISA
      *** MEUS EVENTOS ***
      CHURRAS
      R$ 30,00
      sou Lia · 3 pessoas
      agora
      OUTRO EVENTO
      ENTRAR
      """
    E o código do evento não pega o foco sozinho
    Quando eu digito o código "praia"
    Então o endereço termina em "?evento=praia"
    Quando eu abro o site sem código
    E eu toco no "churras" da lista
    Então o endereço termina em "?evento=churras"
    E o cabeçalho diz "sou Lia"

  Cenário: o ✕ esquece o evento só da lista, e ele volta lembrando quem eu sou
    Quando eu abro o evento "churras" como Lia
    E eu entro no evento "praia" como Lia
    E eu toco no nome do evento
    E eu toco no ✕ do "churras"
    Então o site pergunta "Esquecer churras?" com o botão vermelho
    Quando eu confirmo
    Então a lista do cartão tem só "praia"
    Quando eu entro no evento "churras"
    Então o cabeçalho diz "sou Lia"

  Cenário: esquecer o evento aberto leva pro cartão do código
    Quando eu abro o evento "churras" como Lia
    E eu toco no nome do evento
    E eu toco no ✕ do "churras"
    E eu confirmo, e a página recarrega
    Então aparece o cartão do código
    E a lista de eventos está vazia

  Cenário: o que mudou em outro aparelho entra no saldo da lista e na soma
    Com dois eventos ou mais, a soma dos saldos fica em cima da lista.
    Quando eu abro o evento "praia" como Lia
    E eu entro no evento "churras" como Lia
    E a Mengla paga R$ 100,00 pra Lia no "praia", em outro aparelho
    E eu toco no nome do evento
    Então o saldo do "praia" na lista é "quite"
    E em cima da lista diz "no total: você deve R$ 30,00", em vermelho

  Cenário: evento parado em que me devem ganha um selo de cobrança
    Uma semana sem mudança e com dinheiro pra receber: a lista lembra de cobrar.
    O evento parado em que eu devo não ganha selo.
    Dado que o "churras" mudou pela última vez há 10 dias
    E que o "praia" mudou pela última vez há 12 dias
    Quando eu abro o evento "churras" como Lia
    E eu entro no evento "praia" como Lia
    E eu toco no nome do evento
    Então o "praia" tem o selo "parado há 12 dias · te devem R$ 100,00"
    Mas o "churras" não tem selo

  Cenário: a cobrança de evento parado muda o tom
    Dado que o "churras" mudou pela última vez há 10 dias
    Quando eu abro o evento "churras" como Lia
    E eu toco em enviar
    Então o zap abre com a mensagem:
      """
      👀 lembra do *churras*? faz 10 dias e ainda tem R$ 60,00 pendurado…

      💸 Fernando paga R$ 30,00 pra Júlia
      💸 Lia paga R$ 30,00 pra Júlia

      tudo aqui 👉 {link do evento}
      """

  Cenário: depois de um mês parado, quem cobra é a diva
    Dado que o "churras" mudou pela última vez há 40 dias
    Quando eu abro o evento "churras" como Lia
    E eu toco em enviar
    Então a mensagem do zap começa com "💅 meu bem, o *churras* faz 40 dias e tem R$ 60,00 pendurado. fiado tem limite, viu?"

  Cenário: no modo chato a diva não cobra, só lembra
    Dado que o "churras" mudou pela última vez há 40 dias
    E que este aparelho está no modo chato
    Quando eu abro o evento "churras" como Lia
    E eu toco em enviar
    Então a mensagem do zap começa com "👀 lembra do *churras*? faz 40 dias e ainda tem R$ 60,00 pendurado…"
