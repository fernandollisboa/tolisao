# language: pt
Funcionalidade: O tema
  O recibo é papel de dia. No pé da nota dá pra trocar pro natal, que segue claro, ou pro escuro de noite,
  e o aparelho lembra da escolha; no tema do celular, o recibo escurece junto com ele.

  Contexto:
    Dado o evento "bailedamada" com Fernando, Júlia e Lia
    E o Fernando pagou R$ 90 dividido igual entre todo mundo
    Quando eu abro o evento como Lia

  Cenário: cada toque troca o tema, e o aparelho lembra
    Então o pé da nota diz "tema: papel"
    E o recibo é claro
    Quando eu toco no tema
    Então o pé da nota diz "tema: natal"
    E o recibo é claro
    Quando eu toco no tema
    Então o pé da nota diz "tema: neon"
    E o recibo é escuro
    Quando eu toco no tema
    E eu recarrego a página
    Então o pé da nota diz "tema: grafite"
    E o recibo é escuro

  Cenário: quem não usa o dedo também troca o tema
    Teclado e leitor de tela chegam em tudo que se toca na nota.
    Quando eu troco o tema só com o teclado
    Então o pé da nota diz "tema: natal"

  Cenário: no tema do celular, o recibo segue o claro e o escuro dele
    Quando eu toco no tema 4 vezes
    Então o pé da nota diz "tema: celular"
    E o recibo é claro
    Quando o celular passa pro escuro
    Então o recibo é escuro
    Quando o celular volta pro claro
    Então o recibo é claro

  Cenário: no fim do ano, quem nunca escolheu chega no natal, e o papel continua na roda
    O natal é o tema de todo mundo até o dia de Reis, e a diva fala de gorro; quem prefere o papel escolhe ele e fica nele.
    Quando o calendário chega em "2026-12-20"
    E eu recarrego a página
    Então o pé da nota diz "tema: natal"
    E o recibo é claro
    E o subtítulo diz "pra quem eu devo, noel?"
    Quando eu toco no tema 4 vezes
    E eu recarrego a página
    Então o pé da nota diz "tema: papel"
    E o subtítulo diz "pra quem eu devo?"

  Cenário: passado o dia de Reis, o natal sai do padrão
    Quando o calendário chega em "2027-01-07"
    E eu recarrego a página
    Então o pé da nota diz "tema: papel"
