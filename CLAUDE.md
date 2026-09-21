# CLAUDE.md

## O que é

"Tô Lisa(o) · quem me deve?": divisor de gastos entre amigos, estilo Splitwise, sem app e sem cadastro.
Um único `index.html` (CSS e JS embutidos) publicado no GitHub Pages, com Firebase Realtime Database via REST.
Site: https://fernandollisboa.github.io/splitwise-lite/ (link curto: tinyurl.com/tolisao). Tudo em pt-BR.

## Estrutura

- `index.html`: página inteira. Seções na ordem: header (evento · sou fulano) → Minha conta → Itens (recolhido) → Acerto → membros/copiar link → rodapé. Overlays em `#overlay` (cartões de papel), formulário de anotar em `#sheet`.
- `fonts/`: VT323 e Permanent Marker (woff2). `icon.png`, `og.png`/`og2.png`: ícone e preview do WhatsApp (o `og:image` aponta pra `og2.png` pra furar cache).
- `tests/`: scripts Playwright (`node tests/run-all.cjs`). Sem framework: cada script sobe um servidor local, intercepta o Firebase e imprime o que checou.
- `.github/workflows/pages.yml`: deploy da `main`. Pushes seguidos cancelam o deploy anterior; espere o último terminar antes de conferir o site.

## Comandos

- Rodar: abra `index.html` num servidor estático qualquer (`python3 -m http.server`). Não há build.
- Testes: `npm i -D playwright && npx playwright install chromium` (ou playwright global) e `node tests/run-all.cjs`.
- Checar sintaxe rápido: `node -e "const s=require('fs').readFileSync('index.html','utf8');new Function(s.match(/<script>([\s\S]*)<\/script>/)[1])"`.

## Dados

- Sala: `rooms/<sha256(código)>` com `{v, name, people[], expenses[], deleted[], updatedAt}`. Ids vêm de `uid()` (base36). Item com `kind:'payment'` é uma quitação. `shares` (centavos por pessoa) só em divisão desigual. Empréstimo = pagador fora de `among`.
- Sincronização: `merge()` faz união por id, exclusões vencem, e roda `clean()` em tudo que vem do banco ou do cache. Comparação com `canon()` (chaves ordenadas) pra não regravar à toa.
- Pix: `pix/<sala>/<pessoa>/{key, tok}`. `key` legível por todos; só quem tem o `tok` (localStorage do aparelho que cadastrou) troca. Só chave aleatória ou e-mail (`validPixKey`).
- Regras do banco estão no README. Quem tem o código lê e escreve na sala; a lista de eventos é pública por design.

## Convenções

- Tudo que vem do banco é hostil: ids só passam se casarem `/^[a-z0-9]{1,32}$/` (entram em atributos HTML sem escape), textos passam por `esc()` antes de `innerHTML`.
- Cores dos nomes: `PALETTE` por índice na lista de pessoas, sem vermelho/verde (reservados a deve/recebe). O recibo em canvas usa `MARK` na mesma ordem de tons; nada de amarelo lá.
- Cifrão (`money()`) em Minha conta, Acerto e total; itens sem.
- Texto do zap (`summaryText`) leva o acerto e o link do evento; a imagem (`renderReceipt`) leva membros, itens, saldo e quem paga quem.
- Preferir editar `index.html` com trechos pequenos; sem dependências novas; sem framework.
- Antes de subir: rodar `node tests/run-all.cjs`. Ao mexer em layout, tirar screenshot com Playwright em 390px de largura.
