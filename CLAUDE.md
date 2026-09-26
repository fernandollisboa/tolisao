# CLAUDE.md

## o que é

"tô lisa · quem me deve?": divisor de gastos entre amigos, tipo Splitwise, sem app e sem cadastro. `index.html`, `style.css` e `app.js`, sem build, no GitHub Pages, com Firebase Realtime Database via REST. site: https://tolisa.com.br/. tudo em pt-BR.

## estrutura

- `index.html`: header (evento · sou fulano) → Minha conta → Itens (recolhido) → Falta pagar → membros → rodapé. overlays em `#overlay`, formulário em `#sheet`. o nome do evento abre `showRoom()` (recibo com sair e voltar).
- `app.js`: tudo num IIFE com `// @ts-check` e tipos em JSDoc no topo (`Person`, `Expense`, `Room`, `Transfer`). `npm run types` tem que sair limpo.
- `style.css`: papel e madeira, fonte VT323.
- `manifest.json` + `sw.js`: PWA mínima, rede primeiro com cache de reserva. mudou a estratégia, troque o nome `CACHE`. instalar fica atrás da flag `INSTALAR`: botão âmbar `#instalar` no rodapé (só quando dá pra instalar) e um convite único no ✎ na segunda visita (`convidaInstalar`). no iPhone o botão ensina o Compartilhar do Safari.
- `fonts/`: VT323 (OFL 1.1) e Permanent Marker (Apache 2.0), não são MIT.
- `ficha-*.png`: ícones, gerados por `node tests/icone.cjs`. `diva.png`: fonte deles e da `.stain`, a ficha que cai no rodapé quando a pessoa chega no fim da página, sempre a última da fila do `agenda()`, uma vez por visita. no toque ela é pegável: dois toques treme, o terceiro agarra; solta devagar volta pro papel, solta com força voa (`PEGA_FICHA` liga no mouse). modo chato: forte, fraco, forte na ficha desliga a diva ("Deus é fiel."); o mesmo no `#signoff` liga. guardado em `racha:chato`. o `body` usa `overflow-x:clip`, não `hidden`.
- a cor da ficha diz como você tá: vermelho deve, verde recebe, rosa quite, âmbar quem não disse quem é.
- `og5.jpg`: preview do WhatsApp. abaixo de uns 300 KB, senão o WhatsApp ignora. trocar o nome fura o cache dele.
- `tests/`: cucumber em português (`playwright-bdd` em cima do `@playwright/test`).
  - `features/*.feature` é a especificação, `passos/*.cjs` os passos.
  - `passos/_mundo.cjs` é o fixture de cada cenário: banco falso, aparelhos, página da vez. no fim ele falha se a página deu erro, abriu diálogo nativo ou tentou listar eventos.
  - `_banco.cjs` imita o Firebase com as regras do README. `_serve.cjs` serve o repo na porta 0. `_bonito.cjs` é o reporter, que imprime o `.feature` com os passos em verde e vermelho.
  - animação não tem teste automático: confira no vídeo.
  - `preview.cjs` e `video.cjs` não são testes, são geradores de imagem e de `.webm` (cenas `cascata`, `pix`, `piscas`, `troca`, `chave`, `ficha`, `pega`, `chato`, `dica`, `toque`, `itens`, `risco`, `datilo`; `--css=` e `--js=` pra comparar variações). `_ficha.cjs` tem os gestos da ficha. `noar.cjs` confere o que tá publicado.
- `.github/workflows/`: `tests.yml` (check `test`, em PR) e `pages.yml` (deploy). leia **deploy** antes de subir.
- `CONTRIBUTING.md`: as mesmas regras pra gente. mexeu em convenção aqui, atualize lá.
- `package.json`: só ferramenta de desenvolvimento. o site não carrega nada disso.
- evento novo: nada abre sozinho. o `#whoBtn` leva a `showSetup` (sem gente) ou `showWho`. evento com uma pessoa só já entra como ela. sem gasto o zap some e o balão `#dica` aponta pro ✎.
- endereço: `?senha=<código>` (`openGroup` faz `replaceState`). recarregar com o mesmo código abre direto. colar outro link na aba recarrega sozinho. o `ask()` tem voltar, e código errado devolve o cartão com o que foi digitado.
- `#app` nasce com `loading`. `openGroup` tira depois do primeiro fetch, e um `setTimeout` no HTML tira em 8s.

## comandos

- rodar: `python3 -m http.server`.
- testes: `npm ci && npx playwright install chromium`, depois `npm test` (`npm test -- pix` roda um arquivo). se o chromium da máquina for de outra versão, `PW_CHROMIUM=/caminho/do/chrome npm test`.
- tipos: `npm run types`. sintaxe: `node --check app.js`.

## deploy

a `main` é o que tá no ar. quem publica é o `.github/workflows/pages.yml`, e só ele (fonte do Pages: GitHub Actions).

quando o usuário escolhe uma opção que você ofereceu, isso já é o aval: commite, mergeie e suba sem perguntar de novo.

a `main` exige o check `test` e recusa push direto. então:

1. `npm run types` limpo e `npm test` verde.
2. branch, PR, espera o check verde, merge (`--merge --delete-branch`). check verde basta, sem pedir confirmação.
3. `git checkout main && git pull origin main`.
4. espera o deploy e roda **`node tests/noar.cjs`**. só depois diga que tá no ar.

o `?v=` de `app.js` e `style.css` vira o SHA do commit no deploy. o valor escrito no `index.html` é reserva: suba ele (data + letra) junto com mudança visual; o workflow avisa se esquecer.

armadilhas:
- **o Pages já publicou duas vezes.** com a fonte em "deploy from a branch", o "pages build and deployment" publicava a branch crua depois e ganhava, com `?v=__V__` literal e CSS velho por dias. se alguém mexer em Settings → Pages, isso volta.
- **pushes seguidos cancelam o deploy anterior.** espere o último antes de conferir.

## dados

- sala: `rooms/<sha256(código)>` com `{v, name, people[], expenses[], deleted[], updatedAt}`. ids de `uid()`. `kind:'payment'` é quitação. `shares` (centavos) só em divisão desigual. pagador fora de `among` é empréstimo.
- sync: `merge()` une por id, exclusão vence, `clean()` em tudo que vem do banco ou do cache, `canon()` pra não regravar à toa.
- pix: só pelo `#pixBtn` âmbar. `pix/<sala>/<pessoa>/{key, tok}`: `key` todo mundo lê, só quem tem o `tok` troca. só chave aleatória ou e-mail (`validPixKey`).
- regras no README: leitura e escrita por sala. o `.read` nunca sobe pro nó `rooms`, senão `GET /rooms.json` baixa tudo.

## convenções

- o banco é hostil: id casa `/^[a-z0-9]{1,32}$/`, texto passa por `esc()`.
- cores: `PALETTE` por índice, sem vermelho/verde. marca-texto é `MARKR`, os mesmos matizes mais firmes. nada de amarelo.
- **animações**: nada anima fora da tela. um `IntersectionObserver` marca `#mine`, `#itemsSec` e `#settle`, e o `agenda()` enfileira na ordem da página: piscadas dos ✔ → toque na linha dos itens → voltas do círculo → riscos dos pagamentos. a fila reserva a entrada do bloco seguinte, não a duração do anterior. bloco vazio reserva zero. as horas são absolutas (atraso positivo espera, negativo retoma), então o poll não atrapalha. o copiar pix corre por fora. o toque grande dos itens só nas primeiras `APERTO_VISITAS`, depois `suave`. sala ou pessoa nova chama `rearmaAnims()`.
- cifrão em Minha conta, Falta pagar e total; itens sem. quem tá quite vê "tudo quite!" com o emoji de `festeja()`.
- frase curta de tela leva ponto ou exclamação. emoji só no 👀 do cobrar e na caixinha de quite.
- o balão `.dicaok` sai uma vez por aparelho, atrás da última piscada, preso na linha e medido pelo ✔. `racha:viuAcerto` só grava no `animationstart`. dispensar é `dicaT = -1`. fechar no toque não chama `render()`, senão o confete sai do canto.
- ações só em Minha conta: ✔ quita, copiar pix brota de trás dele quando a chave chega. Falta pagar só mostra. `COBRAR`, `DESFAZER` e `MEMBROS` desligados.
- toque: a classe `tocou` vem de `pointerdown` de captura (não `:active`), tira o `animation-delay` inline, e o mouse fica de fora. tocou um, `tocouOk` para as piscadas. no desktop, hover preenche o botão (`!important` no ✔ e no `#pixBtn`).
- valor digitado passa por `numVal()`. campo é `type="text"` com `inputmode="decimal"`.
- edição pequena, sem dependência no site, sem framework, sem build.
- **mudança visual termina com preview enviado ao usuário**, sem ele pedir (skill `preview`, `tests/preview.cjs`). opções vão numa folha comparativa em tamanho real. **animação vai de vídeo** (`node tests/video.cjs <cena>`).
