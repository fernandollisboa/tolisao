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

  Esquema do Cenário: o cartão barra o que não é chave aleatória nem e-mail
    Quando eu abro o evento como Fernando
    E eu cadastro a chave pix "<chave>"
    Então o cartão barra a chave em vermelho

    Exemplos:
      | o que é            | chave             |
      | CPF                | 123.456.789-09    |
      | telefone           | +5583999998888    |
      | e-mail pela metade | fernando@exemplo  |
      | recado             | me paga no pix    |

  Cenário: voltar a digitar tira o vermelho
    Quando eu abro o evento como Fernando
    E eu cadastro a chave pix "123.456.789-09"
    Então o cartão barra a chave em vermelho
    Quando eu volto a digitar
    Então o vermelho sai

  Esquema do Cenário: chave aleatória e e-mail entram, sempre em minúsculas
    Quando eu abro o evento como Fernando
    E eu cadastro a chave pix "<chave>"
    Então aparece o aviso "Chave Pix salva"
    E o cartão fecha
    E o banco guarda a chave do Fernando "<guardada>"
    E o cabeçalho diz "sou Fernando"

    Exemplos:
      | o que é              | chave                                | guardada                             |
      | chave aleatória      | 7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d | 7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d |
      | e-mail               | fernando@exemplo.com                 | fernando@exemplo.com                 |
      | chave em maiúsculas  | 7D9F2A1C-3B4E-4F5A-8C6D-0E1F2A3B4C5D | 7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d |
      | e-mail em maiúsculas | Fernando@Exemplo.com                 | fernando@exemplo.com                 |

  Cenário: outro aparelho não troca a chave
    Dado que o Fernando já cadastrou a chave pix "7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d" em outro aparelho
    Quando eu abro o evento como Fernando
    Então não aparece o botão de cadastrar pix
    E o cartão de quem é você não tem campo de pix
    Quando eu tento gravar a chave do Fernando "hacker@mal.com" direto no banco
    Então o banco recusa
    E o banco guarda a chave do Fernando "7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d"
