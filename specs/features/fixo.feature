# language: pt
Funcionalidade: Conta fixa, que volta todo mês
  Aluguel, luz e internet da casa se anotam uma vez: o gasto volta sozinho no mesmo
  dia de cada mês, e a república ou o casal não digita tudo de novo.

  Contexto:
    Dado o evento "casa" com Ana e Bia

  Cenário: anotar um gasto que repete todo mês
    Quando eu abro o evento como Ana
    E eu anoto "Luz" de R$ 300,00 dividido igualmente, todo mês
    Então o "Luz" repete todo mês

  # o relógio dos testes marca 10/03
  Esquema do Cenário: o gasto fixo volta a cada mês, no mesmo dia, sem ninguém anotar
    Dado o "Aluguel" de R$ 2.000,00, que a Ana paga todo mês desde <desde>
    Quando eu abro o evento como Bia
    Então a lista tem <itens> itens
    E eu devo R$ <devo> pra Ana

    Exemplos:
      | desde | itens | devo     |
      | 05/01 | 3     | 3.000,00 |
      | 20/01 | 2     | 2.000,00 |

  Cenário: o mês que alguém apagou não volta
    Dado o "Aluguel" de R$ 2.000,00, que a Ana paga todo mês desde 05/02
    Quando eu abro o evento como Ana
    E eu abro a lista de itens
    E eu excluo o "Aluguel" deste mês
    E eu recarrego a página
    Então o "Aluguel" aparece 1 vez na lista
