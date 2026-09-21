# CLAUDE.md

## O que é

"Tô Lisa(o) · quem me deve?": divisor de gastos entre amigos, estilo Splitwise, sem app e sem cadastro.
Três arquivos estáticos (`index.html`, `style.css`, `app.js`), sem build, publicados no GitHub Pages, com Firebase Realtime Database via REST.
Site: https://fernandollisboa.github.io/splitwise-lite/ (link curto: tinyurl.com/tolisao). Tudo em pt-BR.

## Estrutura

- `index.html`: marcação. Seções na ordem: header (evento · sou fulano) → Minha conta → Itens (recolhido) → Acerto → membros/copiar link → rodapé. Overlays em `#overlay` (cartões de papel), formulário de anotar em `#sheet`.
- `app.js`: toda a lógica, num IIFE, com `// @ts-check` e tipos em JSDoc no topo (`Person`, `Expense`, `Room`, `Transfer`). `jsconfig.json` define as opções (não estrito). Zero erros é o esperado.
- `style.css`: estilos (tema papel/madeira, fonte VT323).
- `manifest.json` + `sw.js`: PWA mínima. O service worker é rede-primeiro com cache de reserva (só GET da própria origem); ao mudar a estratégia, troque o nome `CACHE`.
- `fonts/`: VT323 e Permanent Marker (woff2). `diva.png` (+ `-192`, `-maskable`): ícone da PWA, favicon e figurinha do canto; `og.png`/`og2.png`: preview do WhatsApp (o `og:image` aponta pra `og2.png` pra furar cache).
- `tests/`: scripts Playwright (`node tests/run-all.cjs`). Sem framework: cada script sobe um servidor local, intercepta o Firebase e imprime o que checou.
- `.github/workflows/pages.yml`: deploy da `main`. Troca `__V__` em `index.html` pelo SHA do commit (query `?v=` em `app.js` e `style.css`) pra furar o cache de 10 min do navegador; sem isso, HTML novo com JS velho quebra a página. Pushes seguidos cancelam o deploy anterior; espere o último terminar antes de conferir o site.
- Estado inicial: `#app` nasce com a classe `loading` (só título e spinner); `openGroup` tira depois do primeiro fetch, e um `setTimeout` inline no HTML tira em 8s como salvaguarda.

## Comandos

- Rodar: abra `index.html` num servidor estático qualquer (`python3 -m http.server`). Não há build.
- Testes: `npm i -D playwright && npx playwright install chromium` (ou playwright global) e `node tests/run-all.cjs`.
- Tipos: `npx -p typescript tsc -p jsconfig.json` (deve sair sem erro). Sintaxe rápida: `node --check app.js`.

## Dados

- Sala: `rooms/<sha256(código)>` com `{v, name, people[], expenses[], deleted[], updatedAt}`. Ids vêm de `uid()` (base36). Item com `kind:'payment'` é uma quitação. `shares` (centavos por pessoa) só em divisão desigual. Empréstimo = pagador fora de `among`.
- Sincronização: `merge()` faz união por id, exclusões vencem, e roda `clean()` em tudo que vem do banco ou do cache. Comparação com `canon()` (chaves ordenadas) pra não regravar à toa.
- Pix: `pix/<sala>/<pessoa>/{key, tok}`. `key` legível por todos; só quem tem o `tok` (localStorage do aparelho que cadastrou) troca. Só chave aleatória ou e-mail (`validPixKey`).
- Regras do banco estão no README. Quem tem o código lê e escreve na sala; a lista de eventos é pública por design.

## Convenções

- Tudo que vem do banco é hostil: ids só passam se casarem `/^[a-z0-9]{1,32}$/` (entram em atributos HTML sem escape), textos passam por `esc()` antes de `innerHTML`.
- Cores dos nomes: `PALETTE` por índice na lista de pessoas, sem vermelho/verde (reservados a deve/recebe). O recibo em canvas usa `MARK` na mesma ordem de tons; nada de amarelo lá.
- Cifrão (`money()`) em Minha conta, Acerto e total; itens sem.
- Frases curtas da interface (rodapé, subtítulo, tutorial) levam ponto final ou exclamação. O rodapé fala como dona de boteco baiana ("meu bem", "meu anjo", "benção"). Emoji só no 👀 do cobrar, no 🎉 do tudo quitado e no 🙏 de "não devo a ninguém".
- Botões do acerto: quem deve vê `quitar` e `copiar pix`; quem recebe veria `cobrar` (abre o zap com valor, pix e link), hoje desligado pela constante `COBRAR`. Texto do zap (`summaryText`) leva o acerto e o link do evento; a imagem (`renderReceipt`) leva membros, itens, saldo e quem paga quem.
- Preferir edições pequenas em `app.js`/`style.css`; sem dependências novas; sem framework; sem build.
- Antes de subir: `tsc -p jsconfig.json` limpo e `node tests/run-all.cjs`. Ao mexer em layout, tirar screenshot com Playwright em 390px de largura.
