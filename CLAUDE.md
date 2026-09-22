# CLAUDE.md

## O que é

"Tô Lisa · quem me deve?": divisor de gastos entre amigos, estilo Splitwise, sem app e sem cadastro.
Três arquivos estáticos (`index.html`, `style.css`, `app.js`), sem build, publicados no GitHub Pages, com Firebase Realtime Database via REST.
Site: https://fernandollisboa.github.io/tolisao/ (link curto: tinyurl.com/tolisapp). Tudo em pt-BR.

## Estrutura

- `index.html`: marcação. Seções na ordem: header (evento · sou fulano) → Minha conta → Itens (recolhido) → Falta pagar → membros → rodapé (o link "copiar link do evento" existe mas está com `hidden`). Overlays em `#overlay` (cartões de papel), formulário de anotar em `#sheet`. O nome do evento abre `showRoom()`, um cartão no estilo recibo com sair (vermelho) e voltar.
- `app.js`: toda a lógica, num IIFE, com `// @ts-check` e tipos em JSDoc no topo (`Person`, `Expense`, `Room`, `Transfer`). `jsconfig.json` define as opções (não estrito). Zero erros é o esperado.
- `style.css`: estilos (tema papel/madeira, fonte VT323).
- `manifest.json` + `sw.js`: PWA mínima. O service worker é rede-primeiro com cache de reserva (só GET da própria origem); ao mudar a estratégia, troque o nome `CACHE`.
- `fonts/`: VT323 e Permanent Marker (woff2). `diva.png` (+ `-192`, `-maskable`): ícone da PWA, favicon e figurinha do canto; `og.png`/`og2.png`: preview do WhatsApp (o `og:image` aponta pra `og2.png` pra furar cache).
- `tests/`: scripts Playwright (`node tests/run-all.cjs`). Sem framework: cada script sobe um servidor local, intercepta o Firebase e imprime o que checou. `tests/preview.cjs` não é teste: é o gerador de imagens pro usuário ver.
- `.github/workflows/pages.yml`: deploy da `main`. Veja **Deploy** abaixo antes de subir qualquer coisa.
- Estado inicial: `#app` nasce com a classe `loading` (só título e spinner); `openGroup` tira depois do primeiro fetch, e um `setTimeout` inline no HTML tira em 8s como salvaguarda.

## Comandos

- Rodar: abra `index.html` num servidor estático qualquer (`python3 -m http.server`). Não há build.
- Testes: `npm i -D playwright && npx playwright install chromium` (ou playwright global) e `node tests/run-all.cjs`.
- Tipos: `npx -p typescript tsc -p jsconfig.json` (deve sair sem erro). Sintaxe rápida: `node --check app.js`.

## Deploy

O site é a `main`: o que está lá é o que está no ar. A fonte do Pages é **GitHub Actions**, então quem publica é `.github/workflows/pages.yml`, e só ele.

Quando o usuário escolhe uma das opções que você ofereceu, isso já é o aval: commite, mergeie na `main` e suba, sem perguntar de novo.

1. `tsc -p jsconfig.json` limpo e `node tests/run-all.cjs` verde.
2. Merge na `main` e `git push origin main`.
3. Espere o deploy e rode **`node tests/noar.cjs`**: ele baixa o que está publicado e compara com o repositório. Só depois diga que está no ar.

O `?v=` de `app.js` e `style.css` é trocado pelo SHA do commit na hora do deploy, então não há o que lembrar. O valor escrito no `index.html` (hoje `?v=20260922b`) é reserva: se algum dia o Pages voltar a publicar a branch crua, é ele que chega no navegador — aí suba esse número junto com a mudança (data mais uma letra). O workflow avisa se você esquecer.

Duas armadilhas que já custaram caro:

- **O Pages já publicou duas vezes.** Com a fonte em "Deploy from a branch", rodava também o "pages build and deployment", que publica a branch crua e termina *depois* — ele ganhava. O `index.html` que chegava no navegador era o do repositório, com `?v=__V__` literal: uma URL que nunca mudava, e o navegador servia CSS velho por dias. Se alguém mexer em Settings → Pages, é isso que volta.
- **Pushes seguidos cancelam o deploy anterior.** Espere o último terminar antes de conferir.

O próprio workflow confere no fim se o site já responde com a versão nova, e falha se não responder em dois minutos. Ainda assim, quem dá a palavra final é o `tests/noar.cjs`, porque ele compara o conteúdo dos arquivos, não só a versão.

## Dados

- Sala: `rooms/<sha256(código)>` com `{v, name, people[], expenses[], deleted[], updatedAt}`. Ids vêm de `uid()` (base36). Item com `kind:'payment'` é uma quitação. `shares` (centavos por pessoa) só em divisão desigual. Empréstimo = pagador fora de `among`.
- Sincronização: `merge()` faz união por id, exclusões vencem, e roda `clean()` em tudo que vem do banco ou do cache. Comparação com `canon()` (chaves ordenadas) pra não regravar à toa.
- Pix: `pix/<sala>/<pessoa>/{key, tok}`. `key` legível por todos; só quem tem o `tok` (localStorage do aparelho que cadastrou) troca. Só chave aleatória ou e-mail (`validPixKey`).
- Regras do banco estão no README: leitura e escrita por sala (`rooms/$room`), sem leitura da raiz, então não há como listar eventos. Não existe mais tela de listagem; clicar no nome do evento abre o cartão `showRoom()` com sair/voltar.

## Convenções

- Tudo que vem do banco é hostil: ids só passam se casarem `/^[a-z0-9]{1,32}$/` (entram em atributos HTML sem escape), textos passam por `esc()` antes de `innerHTML`.
- Cores dos nomes: `PALETTE` por índice na lista de pessoas, sem vermelho/verde (reservados a deve/recebe). O recibo em canvas usa `MARK` na mesma ordem de tons; nada de amarelo lá.
- Cifrão (`money()`) em Minha conta, Falta pagar e total; itens sem.
- Frases curtas da interface (rodapé, subtítulo, tutorial) levam ponto final ou exclamação. O rodapé fala como dona de boteco baiana ("meu bem", "meu anjo", "benção"). Emoji só no 👀 do cobrar, no 🎉 do tudo quitado e no 🙏 de "não devo a ninguém".
- Ações ficam só em Minha conta: nas linhas de quem você deve aparecem `quitar` (✔, com sombra) e `copiar pix`. A seção Falta pagar (`#settle`) é só leitura, mostra quem paga quem. O `cobrar` segue no código atrás da constante `COBRAR`, hoje desligado. O link `desfazer` nas linhas pagas sai pela constante `DESFAZER`; existe pra testar. O link `dividir em partes diferentes` sai pela constante `PARTES`, à espera de um lugar melhor; o recurso continua funcionando e o teste `feat` revela o link pra exercitá-lo. Texto do zap (`summaryText`) leva o acerto e o link do evento; a imagem (`renderReceipt`) leva itens e um saldo que é só quem paga quem mais os já quites; os nomes aparecem marcados dentro das próprias linhas, sem legenda no topo.
- Valores digitados passam por `numVal()`, que aceita vírgula decimal e ponto de milhar; os campos são `type="text"` com `inputmode="decimal"`, porque `type="number"` engole a vírgula no teclado pt-BR.
- Preferir edições pequenas em `app.js`/`style.css`; sem dependências novas; sem framework; sem build.
- Antes de subir: `tsc -p jsconfig.json` limpo e `node tests/run-all.cjs`.
- **Toda mudança visual termina com preview enviado ao usuário**, sem ele pedir. Use a skill `preview` (`.claude/skills/preview/SKILL.md`) e o gerador `tests/preview.cjs`; pra propor opções, mande uma folha comparativa em tamanho real.
