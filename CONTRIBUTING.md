# como mexer no tô lisa

html, css e js. sem build, sem framework. o único backend é a API do aviso de pagamento em `servidor/`. a `main` é o que tá no ar em [tolisa.com.br](https://tolisa.com.br/). tudo em português, código e tela.

## rodar

```sh
python3 -m http.server
```

salvou, recarregou, tá valendo.

## antes de subir

```sh
npm ci && npx playwright install chromium   # uma vez (se já tiver um chromium, o teste acha)
npm run formata                             # prettier no app.js
npm run qualidade                           # sintaxe, formato, tipos, regras e testes: verde
```

os testes são cucumber em português: a especificação fica em `specs/features/*.feature` e os passos em `specs/passos/`. `npm test -- pix` roda só um arquivo. falhou? o erro sai embaixo do passo, e o fim da saída diz como abrir o trace.

`npm run regras` confere, sem navegador, o que nenhum cenário pega: a CSP só roda script do site e só fala com o firebase e a API do aviso (`servidor/`), o banco não deixa listar salas nem ler o `tok` do pix, o `clean()` corta no tamanho que o banco valida e as imagens do link (`og/`) cabem no WhatsApp. falhou, ele diz o que trocar.

`npm run cobertura` roda os mesmos testes e diz quanto do `app.js` eles executam, com os trechos que nenhum cenário alcança. serve pra achar fluxo sem cenário, não é meta: animação e gesto se conferem no vídeo.

## não rola

- **dependência nova no site.** o navegador não tem? a gente escreve (por isso existem `crc16`, `code128Widths` e o recibo em canvas). ferramenta de desenvolvimento pode.
- **dependência na API além do `wrangler`.** o `servidor/` é um Worker da Cloudflare em JS puro, testado com `cd servidor && npm test`; sobe sozinho pelo `servidor.yml` quando muda na `main`.
- **build, bundler, framework.** tipo é JSDoc com `// @ts-check`.
- **reescrita grande.** edição pequena em `app.js`/`style.css`. o formato é do prettier (`npm run formata`), não se discute.
- **inglês na tela.** o rodapé fala como dona de boteco baiana.

## estilo

- flag em maiúscula no topo do `app.js` liga e desliga coisa (`INSTALAR`, `PEGA_FICHA`, `DESFAZER`). coisa meio pronta entra atrás de flag.
- o banco é hostil: id só passa se casar `/^[a-z0-9]{1,32}$/`, texto passa por `esc()` antes de `innerHTML`.
- dinheiro é centavo inteiro até virar texto em `reais()`/`comSifrao()`/`valorHtml()`. o `amount` do banco é em reais: leia com `centavos(e)`.
- cor de gente sai de `PALETTE`/`MARKR` pelo índice. vermelho e verde são de deve/recebe.
- animação nova entra na fila do `agenda()` e só roda com a seção na tela.
- teste não pode deixar o CI lento: cenário que precisa esperar animação não entra. animação se confere no vídeo.
- cenário diz o comportamento, não a implementação: quem só usa o app lê e entende. `Dado` monta o estado direto (não clica até ele), `Quando` é uma ação da pessoa, `Então` é o que ela vê. nome, valor e data só quando mudam o resultado. a parte técnica fica dentro do passo. o guia completo, com exemplo, está em `.claude/skills/gherkin/SKILL.md`.

## mudou a tela? manda imagem

```sh
node specs/preview.cjs '#mine'
node specs/video.cjs pega --vel=0.35   # animação vai de vídeo
```

tamanho real, 390 de largura. detalhes em `.claude/skills/preview/SKILL.md`.

## commit

português, maiúscula, sem ponto, dizendo o que mudou pra quem usa o site:

```
A ficha tem a cor da sua situação
```

## deploy

a `main` é protegida: branch → PR → check `test` verde → merge. PR que resolve issue leva `Closes #N` na descrição (em inglês, uma por linha): é assim que o GitHub fecha a issue no merge; resolveu só parte, `Refs #N`. quem publica é o `.github/workflows/pages.yml`, e só ele (a fonte do Pages é GitHub Actions; mexer nisso em Settings faz o site servir CSS velho por dias). depois do merge, o site tá no ar quando o `pages.yml` termina verde.

## banco

firebase no plano gratuito, por REST direto do navegador. as regras tão no `database.rules.json`, e uma não se negocia: **o `.read` fica dentro do `$room`, nunca em `rooms`**, senão um `GET /rooms.json` baixa o banco inteiro.

o `visitas/<dia>` conta aparelhos por dia (`CONTA_VISITAS`): só aceita um `.sv increment` de +1, não tem `.read` e não deixa apagar. o número se lê no console do firebase. o `npm run regras` confere ("visitas só se soma").
