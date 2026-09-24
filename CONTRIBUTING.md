# Como mexer no tô lisa

Site em três arquivos estáticos (`index.html`, `style.css`, `app.js`), sem build, sem framework e sem backend. A `main` é o que está no ar em [tolisa.com.br](https://tolisa.com.br/). Tudo em pt-BR, código e interface.

## Rodar

```sh
python3 -m http.server        # ou qualquer servidor estático
```

Abra `http://localhost:8000`. Não há passo de build: salvou, recarregou, está valendo. A URL do banco é a constante `DB` no topo do `app.js`.

## Antes de subir qualquer coisa

```sh
npm ci && npx playwright install chromium   # uma vez só
npm run types                               # tem que sair limpo
npm test                                    # tem que sair verde
```

`npm test pix xss` roda só o que você quer, `npm test -- --segue` vai até o fim mesmo com falha e `npm test -- --lista` diz que nomes existem.

`node --check app.js` dá uma conferida rápida de sintaxe quando você só quer saber se o arquivo fecha.

## O que o projeto não aceita

- **Dependência nova.** Nenhuma. O que o navegador não traz de casa, a gente escreve (é por isso que existem `crc16`, `code128Widths` e o recibo em canvas aqui dentro).
- **Build, bundler, framework, TypeScript de verdade.** Os tipos são JSDoc com `// @ts-check`; `jsconfig.json` guarda as opções.
- **Reescrita grande.** Prefira a edição pequena no `app.js`/`style.css`. O arquivo é denso de propósito: uma ideia por linha, comentário só quando explica um *porquê* que o código não conta.
- **Texto em inglês na tela.** A interface fala português, e o rodapé fala como dona de boteco baiana.

## Estilo

- Constante em maiúscula no topo do IIFE liga e desliga funcionalidade (`COBRAR`, `MEMBROS`, `INSTALAR`, `PEGA_FICHA`, `DESFAZER`). Coisa meio pronta entra atrás de flag, não em branch parada.
- Tudo que vem do banco é hostil: id só passa se casar `/^[a-z0-9]{1,32}$/` (eles entram em atributo HTML sem escape), texto passa por `esc()` antes de qualquer `innerHTML`.
- Dinheiro é inteiro em centavos na conta e só vira string em `fmt()`/`money()`/`val()`. Nada de `toFixed` no meio do cálculo.
- Cor de pessoa sai de `PALETTE` (texto) e `MARKR` (marca-texto) pelo índice na lista, nunca escolhida na mão. Vermelho e verde são de deve/recebe e não entram na paleta.
- Animação nova entra na fila do `agenda()` e só roda com a seção na tela. Leia a seção **Convenções** do `CLAUDE.md` antes de mexer nisso: a ordem é testada em `tests/ordem.cjs`.

## Mudança visual termina em imagem

Diff não mostra layout.

```sh
node tests/preview.cjs '#mine'                  # recorte de uma seção
node tests/preview.cjs '#settle' --largura=1440 # se o desktop for afetado
node tests/video.cjs pega --vel=0.35            # animação vai de vídeo
```

Padrão é 390 de largura, em tamanho real. Nunca encolha a imagem pra caber mais coisa: o preview passa a mentir. Pra propor opções, monte um arquivo de variantes e mande **uma** folha comparativa (`--variantes=`). Os detalhes estão em `.claude/skills/preview/SKILL.md`.

## Testes

Playwright cru, sem framework. Cada script sobe um servidor local, intercepta o Firebase com dados falsos e imprime o que conferiu; `tests/run-all.cjs` roda todos e para no primeiro que falhar.

| arquivo | o que cobre |
|---|---|
| `ui.cjs` | anotar pelo ✎, quitar, o ver todos, e a página não estourar a largura |
| `feat.cjs` | Minha conta, a ordem do formulário, o hint de falta/sobra das partes |
| `pix.cjs` | só chave aleatória ou e-mail, o `tok` de um aparelho só, o copia e cola |
| `img.cjs` | o png da comanda sai do canvas e o texto do zap fecha |
| `xss.cjs` | nome e descrição hostis não viram HTML |
| `ordem.cjs` | a ordem das animações, ouvindo `animationstart` |
| `pega.cjs` | a ficha pegável e o modo chato |
| `dica.cjs` | o balão dos botões do acerto: uma vez por aparelho, some no toque |

Bug que deu na mão vira teste antes do conserto. As dependências são de desenvolvimento e só: o site não carrega nada disso. `preview.cjs` e `video.cjs` não são testes, são os geradores de imagem e vídeo; `icone.cjs` regenera os `ficha-*.png` da PWA e `noar.cjs` confere o que está publicado.

## Commits e branches

Assunto em português, primeira letra maiúscula, sem ponto final, dizendo o que mudou pra quem usa o site, não pra quem lê o diff:

```
A ficha tem a cor da sua situação
video.cjs: cena itens e --js pra gravar variações do toquinho
```

Prefixo com o arquivo ou a seção (`video.cjs:`, `Itens:`) quando ajuda a achar depois. Trabalho pequeno vai direto na `main`; trabalho que dorme fica numa branch e volta com merge.

## Deploy

Push na `main` publica, e só o `.github/workflows/pages.yml` publica — a fonte do Pages é **GitHub Actions**, não "deploy from a branch". Mexer nisso em Settings → Pages faz o site voltar a servir CSS velho por dias.

Depois do push:

```sh
node tests/noar.cjs   # baixa o que está publicado e compara com o repositório
```

Só depois disso dá pra dizer que está no ar. Pushes seguidos cancelam o deploy anterior: espere o último terminar.

## Banco

Firebase Realtime Database no plano gratuito, falado por REST direto do navegador. As regras estão no `README.md`, e uma delas não se negocia: **o `.read` fica dentro do `$room`, nunca no nó `rooms`**. As regras cascateiam pra baixo e não dá pra revogar mais fundo — com `.read` em `rooms`, um `GET /rooms.json` baixa o banco inteiro e o hash do código deixa de valer de nada.

Dentro de um evento tudo é aberto pra quem tem o código. Não é lugar de guardar nada sensível, e o aviso da tela vale pra sempre: confira o nome do recebedor no app do banco antes de confirmar o Pix.
