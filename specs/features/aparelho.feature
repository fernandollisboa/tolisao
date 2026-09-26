# language: pt
Funcionalidade: O que fica guardado no aparelho
  Sem cadastro, quem você é e o segredo da sua chave pix moram no navegador.
  Tudo fica em duas gavetas: "tolisa", com o que é do aparelho, e
  "tolisa:<sala>", com o que é de cada evento.

  Contexto:
    Dado o evento "bailedamada" com Fernando, Júlia e Lia
    E os gastos:
      | o quê  | valor  | pagou | divide entre          |
      | Airbnb | 300,00 | Júlia | Fernando, Júlia, Lia  |

  Cenário: quem já usava o site não perde quem é nem o segredo da chave
    Dado que este aparelho guardou, do jeito antigo, que eu sou Fernando e o segredo "tok-antigo" da chave dele
    Quando eu abro o evento
    Então o cabeçalho diz "sou Fernando"
    E o aparelho guarda que eu sou "fernando" e o segredo "tok-antigo" da chave do Fernando
    E o aparelho não guarda mais nada do jeito antigo

  Cenário: o segredo da chave nova fica na gaveta do evento
    Quando eu abro o evento como Júlia
    E eu cadastro a chave pix "julia@exemplo.com"
    Então aparece o aviso "Chave Pix salva"
    E o segredo que o banco guarda pra Júlia é o que ficou no aparelho
    Quando eu recarrego a página
    Então o cabeçalho diz "sou Júlia"
