# como mexer no tô lisa

html, css e js. sem build, sem framework, sem backend. a `main` é o que tá no ar em [tolisa.com.br](https://tolisa.com.br/). tudo em português, código e tela.

## rodar

```sh
python3 -m http.server
```

salvou, recarregou, tá valendo.

## antes de subir

```sh
npm ci && npx playwright install chromium   # uma vez
npm run types                               # limpo
npm test                                    # verde
```

os testes são cucumber em português: a especificação fica em `tests/features/*.feature` e os passos em `tests/passos/`. `npm test -- pix` roda só um arquivo. falhou? o erro sai embaixo do passo, e o fim da saída diz como abrir o trace.

## não rola

- **dependência nova no site.** o navegador não tem? a gente escreve (por isso existem `crc16`, `code128Widths` e o recibo em canvas). ferramenta de desenvolvimento pode.
- **build, bundler, framework.** tipo é JSDoc com `// @ts-check`.
- **reescrita grande.** edição pequena em `app.js`/`style.css`.
- **inglês na tela.** o rodapé fala como dona de boteco baiana.

## estilo

- flag em maiúscula no topo do `app.js` liga e desliga coisa (`COBRAR`, `MEMBROS`, `INSTALAR`, `PEGA_FICHA`, `DESFAZER`). coisa meio pronta entra atrás de flag.
- o banco é hostil: id só passa se casar `/^[a-z0-9]{1,32}$/`, texto passa por `esc()` antes de `innerHTML`.
- dinheiro é centavo inteiro até virar texto em `fmt()`/`money()`/`val()`.
- cor de gente sai de `PALETTE`/`MARKR` pelo índice. vermelho e verde são de deve/recebe.
- animação nova entra na fila do `agenda()` e só roda com a seção na tela.

## mudou a tela? manda imagem

```sh
node tests/preview.cjs '#mine'
node tests/video.cjs pega --vel=0.35   # animação vai de vídeo
```

tamanho real, 390 de largura. detalhes em `.claude/skills/preview/SKILL.md`.

## commit

português, maiúscula, sem ponto, dizendo o que mudou pra quem usa o site:

```
A ficha tem a cor da sua situação
```

## deploy

a `main` é protegida: branch → PR → check `test` verde → merge. quem publica é o `.github/workflows/pages.yml`, e só ele (a fonte do Pages é GitHub Actions; mexer nisso em Settings faz o site servir CSS velho por dias). depois do merge, `node tests/noar.cjs` confere se o que tá no ar bate com o repositório.

## banco

firebase no plano gratuito, por REST direto do navegador. as regras tão no `README.md`, e uma não se negocia: **o `.read` fica dentro do `$room`, nunca em `rooms`**, senão um `GET /rooms.json` baixa o banco inteiro.
