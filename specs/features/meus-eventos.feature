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
