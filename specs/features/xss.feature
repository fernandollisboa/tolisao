# language: pt
Funcionalidade: Tudo que vem do banco é hostil
  Id fora de [a-z0-9] é descartado e texto é escapado: nada que alguém grave
  no banco vira HTML na tela de outra pessoa.

  Cenário: HTML nos nomes, nos itens e na chave pix
    Dado que alguém gravou no banco o evento:
      """
      { "name": "bailedamada", "updatedAt": 1, "deleted": [],
        "people": [
          { "id": "fernando", "name": "Fernando", "at": 1 },
          { "id": "lia", "name": "<img src=x onerror=\"window.__xss=1\">Lia", "at": 2 },
          { "id": "x\" onmouseover=\"window.__xss=2\" data-y=\"", "name": "Hacker", "at": 3 } ],
        "expenses": [
          { "id": "a", "desc": "<script>window.__xss=3</script>Cerveja", "amount": 90, "payer": "fernando", "among": ["fernando", "lia"], "at": 3, "by": "<b>x</b>" },
          { "id": "b\"><img src=x onerror=\"window.__xss=4\">", "desc": "Ruim", "amount": 10, "payer": "fernando", "among": ["lia"], "at": 4 },
          { "id": "c", "desc": "Sem payer válido", "amount": 10, "payer": "x\" onmouseover=\"window.__xss=2\" data-y=\"", "among": ["lia"], "at": 5 } ] }
      """
    E a chave pix da Lia é "<img src=x onerror=\"window.__xss=5\">"
    Quando eu abro o evento como Fernando
    E eu abro a lista de itens
    E eu toco no meu nome
    Então nenhum script rodou
    E o quem é você lista 2 pessoas
    E a lista tem 1 item, com o "<script>" escrito como texto
    E não aparece nenhum botão de copiar pix
    E não aparece nenhuma imagem além da ficha

  # os limites do clean() (evento 40, pessoa 30, item 60, quem anotou 30) com um emoji
  # começando exatamente na última unidade que cabe: o slice() parava no meio do par surrogate
  Cenário: emoji no limite do corte não vira meia letra
    Dado que alguém gravou no banco o evento:
      """
      { "name": "aniversario de 40 anos da vovo zizi no 🎉 sitio", "updatedAt": 1, "deleted": [],
        "people": [
          { "id": "fernando", "name": "Fernando", "at": 1 },
          { "id": "lia", "name": "fernando da silva sauro junio🎉", "at": 2 } ],
        "expenses": [
          { "id": "a", "desc": "churrasco de domingo na casa da vovo zizi la no sitio grand🎉 e mais", "amount": 90, "payer": "fernando", "among": ["fernando", "lia"], "at": 3,
            "by": "fernando da silva sauro junio🎉" } ] }
      """
    Quando eu abro o evento como Fernando
    E eu abro a lista de itens
    Então nada na tela tem meia letra
