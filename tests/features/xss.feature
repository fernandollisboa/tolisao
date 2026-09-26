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
    E a lista de gente do rodapé aparece
    Então nenhum script rodou
    E a lista de gente tem 2 pessoas
    E a lista tem 1 item, com o "<script>" escrito como texto
    E não aparece nenhum botão de copiar pix
    E não aparece nenhuma imagem além da ficha
