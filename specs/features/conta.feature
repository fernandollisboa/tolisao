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
