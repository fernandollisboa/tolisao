# language: pt
Funcionalidade: Quanto fica pra cada um
  Antes de anotar, o formulário diz quanto o gasto fica pra cada um.

  Contexto:
    Dado o evento "racha" com Ana, Beto e Caio

  Regra: no empréstimo, a frase do anotar diz quanto o outro passa a dever
    O valor entra pelos centavos, como no app do banco: quem empresta R$ 90 vê o valor certo antes de anotar.

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

    Exemplo: trocar só a descrição não muda quem leva o centavo a mais
      Quando eu abro o evento como Ana
      E eu anoto "Mercado" e depois "Gás", os dois de R$ 100,00 divididos igualmente
      E eu edito o "Mercado"
      E eu troco a descrição do "Mercado" pra "Feira" e salvo
      Então no banco, o centavo a mais do "Feira" continua com a mesma pessoa
