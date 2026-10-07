# language: pt
Funcionalidade: Quanto fica pra cada um
  Antes de anotar, o formulário diz quanto o gasto fica pra cada um.

  Contexto:
    Dado o evento "racha" com Ana, Beto e Caio

  Regra: a frase do anotar diz quanto fica pra cada um
    O valor entra pelos centavos, como no app do banco: quem digita 90 pra uma pizza de R$ 90
    tem que ver o R$ 0,30 antes de anotar, e não depois.

    Esquema do Cenário: a frase mostra a parte de cada um enquanto eu digito
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu digito "<teclas>" no valor
      Então a frase de como está dividido diz "<frase>"
      E o cursor continua no valor

      Exemplos:
        | teclas | frase                                                     |
        | 9000   | Dividido igualmente entre 3 pessoas, R$ 30,00 cada.       |
        | 90     | Dividido igualmente entre 3 pessoas, R$ 0,30 cada.        |
        | 10000  | Dividido igualmente entre 3 pessoas, R$ 33,34 e R$ 33,33. |

    Exemplo: no empréstimo, a frase diz quanto o outro passa a dever
      Quando eu abro o evento como Ana
      E eu toco no ✎
      E eu digito "9000" no valor
      E eu divido só com Beto
      Então a frase de como está dividido diz "Empréstimo: Beto deve R$ 90,00 a Ana."

  Regra: o centavo que sobra não cai sempre na mesma pessoa
    R$ 100,00 entre três não fecha: alguém paga R$ 33,34. Se é sempre o primeiro da turma,
    em quarenta gastos vira assunto no grupo.

    Exemplo: dois gastos de R$ 100,00 entre três, cada centavo a mais com uma pessoa
      Quando eu abro o evento como Ana
      E eu anoto "Mercado" e depois "Gás", os dois de R$ 100,00 divididos igualmente
      Então no banco, o centavo a mais do "Mercado" e o do "Gás" ficam com pessoas diferentes

    Exemplo: o gasto com centavo sobrando continua dividido igualmente
      Quando eu abro o evento como Ana
      E eu anoto "Mercado" de R$ 100,00 dividido igualmente
      Então embaixo dele está escrito "Ana pagou · ÷3"
      Quando eu edito o "Mercado"
      Então a aba igual fica marcada
