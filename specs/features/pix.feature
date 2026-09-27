# language: pt
Funcionalidade: Cadastrar a chave pix
  Só chave aleatória ou e-mail. Quem cadastra guarda um segredo no aparelho,
  e só esse aparelho consegue trocar a chave depois.

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
      | telefone           | +5583999998888   |
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

  Cenário: outro aparelho não troca a chave
    Dado que o Fernando já cadastrou a chave pix "7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d" em outro aparelho
    Quando eu abro o evento como Fernando
    Então não aparece o botão de cadastrar pix
    E o cartão de quem é você não tem campo de pix
    Quando eu tento gravar a chave do Fernando "hacker@mal.com" direto no banco
    Então o banco recusa
    E o banco guarda a chave do Fernando "7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d"
