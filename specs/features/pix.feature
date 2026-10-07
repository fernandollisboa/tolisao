# language: pt
Funcionalidade: Cadastrar a chave pix
  Chave aleatória, e-mail ou celular; CPF não, que todo mundo com o link vê a chave. Quem cadastra guarda um segredo no aparelho,
  e só esse aparelho consegue trocar ou apagar a chave depois, no cartão de quem é você.

  Contexto:
    Dado o evento "bailedamada" com Fernando, Júlia, Lia, Mengla e Klinsmann
    E os gastos:
      | o quê        | valor  | pagou    | divide entre                            |
      | Airbnb       | 510,00 | Fernando | Mengla, Lia, Fernando, Júlia, Klinsmann |
      | Gasolina ida | 136,00 | Júlia    | Mengla, Lia, Fernando, Júlia            |

  Esquema do Cenário: <tipo> não passa
    Quando eu abro o evento como Fernando
    E eu cadastro a chave pix "<chave>"
    Então o cartão barra a chave em vermelho
    Quando eu volto a digitar
    Então o vermelho sai
    Quando eu troco a chave por "fernando@exemplo.com"
    Então o cartão fecha

    Exemplos:
      | tipo               | chave            |
      | CPF                | 123.456.789-09   |
      | CPF sem pontos     | 12345678909      |
      | telefone fixo      | (83) 3222-1234   |
      | e-mail sem o ponto | fernando@exemplo |

  Esquema do Cenário: <tipo> passa
    Quando eu abro o evento como Fernando
    E eu cadastro a chave pix "<chave>"
    Então aparece o aviso "Chave Pix salva"
    E o cartão fecha
    E o banco guarda a chave do Fernando "<fica>"
    E o cabeçalho diz "sou Fernando"

    Exemplos:
      | tipo            | chave                                | fica                                 |
      | chave aleatória | 7D9F2A1C-3B4E-4F5A-8C6D-0E1F2A3B4C5D | 7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d |
      | e-mail          | Fernando@Exemplo.com                 | fernando@exemplo.com                 |
      | celular         | (83) 99999-8888                      | +5583999998888                       |
      | celular com +55 | +55 83 99999-8888                    | +5583999998888                       |

  Cenário: outro aparelho não troca a chave
    Dado que o Fernando já cadastrou a chave pix "7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d" em outro aparelho
    Quando eu abro o evento como Fernando
    Então não aparece o botão de cadastrar pix
    E o cartão de quem é você mostra a chave, cadastrada em outro aparelho
    Quando eu tento gravar a chave do Fernando "hacker@mal.com" direto no banco
    Então o banco recusa
    Quando eu tento gravar a chave do Fernando "" direto no banco
    Então o banco recusa
    E o banco guarda a chave do Fernando "7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d"

  Cenário: sem chave, o cartão de quem é você cadastra
    Quando eu abro o evento como Lia
    E eu cadastro a chave pix "lia@exemplo.com" pelo cartão de quem é você
    Então aparece o aviso "Chave Pix salva"
    E o banco guarda a chave da Lia "lia@exemplo.com"

  Cenário: trocar a chave no aparelho que cadastrou
    Quando eu abro o evento como Fernando
    E eu cadastro a chave pix "fernando@exemplo.com"
    E eu toco no meu nome
    E eu toco em trocar a chave pix
    E eu troco a chave por "fernando@novo.com"
    Então aparece o aviso "Chave Pix salva"
    E o banco guarda a chave do Fernando "fernando@novo.com"

  # apagar grava a chave vazia: sem chave, qualquer aparelho cadastra de novo, como no começo
  Cenário: apagar a chave, e outro aparelho cadastrar de novo
    Quando eu abro o evento como Fernando
    E eu cadastro a chave pix "fernando@exemplo.com"
    E eu toco no meu nome
    E eu apago a chave pix
    Então aparece o aviso "Chave Pix apagada"
    E o banco guarda a chave do Fernando ""
    Quando eu abro o evento como Fernando em outro aparelho
    E eu cadastro a chave pix "fernando@outro.com"
    Então o banco guarda a chave do Fernando "fernando@outro.com"

  Cenário: aparelho sem espaço não cadastra a chave
    Sem o segredo guardado, ninguém mais trocaria nem apagaria a chave: melhor não cadastrar e avisar.
    Quando eu abro o evento como Fernando
    E este aparelho fica sem espaço
    E eu cadastro a chave pix "fernando@exemplo.com"
    Então aparece o aviso "Sem espaço neste aparelho: a chave não salvou"
    E o banco não tem chave do Fernando
