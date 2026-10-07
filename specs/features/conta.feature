# language: pt
Funcionalidade: A conta sempre fecha
  O que um paga, os outros devem, centavo por centavo. Nenhum gasto some calado nem
  conta duas vezes, por maior que seja a turma e por mais aparelhos que mexam ao mesmo tempo.

  Regra: um gasto se divide entre até 100 pessoas

    Cenário: numa formatura, quem dividiu paga a mesma parte que todo mundo
      Dado uma formatura com 60 pessoas, da Ana à Zoe
      E a Ana pagou R$ 600,00 dividido igual entre todo mundo
      Quando eu abro o evento como Zoe
      Então eu devo R$ 10,00 pra Ana

    Cenário: acima de 100 pessoas, o anotar avisa em vez de deixar gente de fora
      Dado uma formatura com 101 pessoas, da Ana à Zoe
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu preencho R$ 101,00 de "Buffet"
      E eu salvo
      Então aparece o aviso "Dá pra dividir entre até 100 pessoas"

  Regra: dois aparelhos mexendo ao mesmo tempo não desequilibram a conta

    Cenário: duas pessoas editam o mesmo item, e vale a última edição
      A Júlia salvou a dela um pouco antes de mim: o item fica com o meu valor, e uma vez só.
      Dado o evento "churras" com Fernando, Júlia e Lia
      E os gastos:
        | o quê | valor | pagou    | divide entre         |
        | Pizza | 60,00 | Fernando | Fernando, Júlia, Lia |
      Quando eu abro o evento como Fernando
      E eu abro a lista de itens
      E eu edito o "Pizza"
      E a Júlia troca o valor da "Pizza" pra R$ 90,00 em outro aparelho
      E eu troco o valor pra R$ 75,00 e salvo
      Então o "Pizza" fica de 75,00
      E falta pagar:
        | quem  | paga pra | valor |
        | Júlia | Fernando | 25,00 |
        | Lia   | Fernando | 25,00 |

    Cenário: quem acabou de entrar num gasto em outro aparelho não sai da lista
      O ✕ só aparece pra quem não tem conta, mas outro aparelho pode ter posto a pessoa num gasto agorinha.
      Dado o evento "churras" com Fernando, Júlia e Lia
      Quando eu abro o evento como Fernando
      E eu toco em quem é você
      E eu escolho outra pessoa
      E outro aparelho anota:
        | o quê | valor | pagou    | divide entre  |
        | Pizza | 60,00 | Fernando | Fernando, Lia |
      E eu tiro a Lia da lista
      Então o evento no banco tem Fernando, Júlia e Lia
      Quando eu continuo
      Então falta pagar:
        | quem | paga pra | valor |
        | Lia  | Fernando | 30,00 |

  Regra: as partes diferentes somam o valor do item

    Cenário: partes que não somam o valor do item viram divisão igual
      O banco é de todo mundo: um item gravado com partes que não fecham não pode sumir com dinheiro.
      Dado que alguém gravou no banco o evento:
        """
        { "name": "churras", "updatedAt": 1, "deleted": [],
          "people": [ { "id": "fernando", "name": "Fernando", "at": 1 }, { "id": "lia", "name": "Lia", "at": 2 } ],
          "expenses": [ { "id": "a", "desc": "Pizza", "amount": 60, "payer": "fernando", "among": ["fernando", "lia"],
                          "shares": { "fernando": 1000, "lia": 2000 }, "at": 1 } ] }
        """
      Quando eu abro o evento como Fernando
      Então falta pagar:
        | quem | paga pra | valor |
        | Lia  | Fernando | 30,00 |
