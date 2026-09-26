# language: pt
Funcionalidade: O banco só aceita a sala do jeito que o app grava
  Quem tem o código escreve na sala direto no banco, sem passar pelo site.
  As regras do README deixam, mas só no formato do app: nada de campo a mais,
  texto gigante ou lista sem fim.

  Cenário: gravar direto no banco, sem passar pelo site
    Dado o evento "bailedamada" com Fernando, Júlia e Lia
    E os gastos:
      | o quê  | valor  | pagou | divide entre         |
      | Airbnb | 300,00 | Júlia | Fernando, Júlia, Lia |
    Quando eu abro o evento como Lia
    Então gravar a sala direto no banco dá:
      | com                         | o banco |
      | nada de diferente           | aceita  |
      | um campo a mais             | recusa  |
      | um campo a mais no gasto    | recusa  |
      | nome com 41 letras          | recusa  |
      | pessoa sem nome             | recusa  |
      | valor em texto              | recusa  |
      | id com maiúscula            | recusa  |
      | gasto sem ninguém dividindo | recusa  |
      | parte negativa              | recusa  |
      | 10001 gastos                | recusa  |
      | versão 3                    | recusa  |
      | texto no lugar da sala      | recusa  |
