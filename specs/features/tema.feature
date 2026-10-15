# language: pt
Funcionalidade: O tema
  O recibo é papel de dia. De noite dá pra trocar pro escuro no pé da nota, e o aparelho lembra
  da escolha; no tema do celular, o recibo escurece junto com ele.

  Contexto:
    Dado o evento "bailedamada" com Fernando, Júlia e Lia
    Quando eu abro o evento como Lia

  Cenário: cada toque troca o tema, e o aparelho lembra
    Então o pé da nota diz "tema: papel"
    E o recibo é claro
    Quando eu toco no tema
    Então o pé da nota diz "tema: neon"
    E o recibo é escuro
    Quando eu toco no tema
    E eu recarrego a página
    Então o pé da nota diz "tema: grafite"
    E o recibo é escuro

  Cenário: no tema do celular, o recibo segue o claro e o escuro dele
    Quando eu toco no tema 3 vezes
    Então o pé da nota diz "tema: celular"
    E o recibo é claro
    Quando o celular passa pro escuro
    Então o recibo é escuro
    Quando o celular volta pro claro
    Então o recibo é claro
