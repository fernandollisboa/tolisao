# Leitor da foto da conta

O 📷 do anotar (protótipo do modo mesa, liga no aparelho com `?mesa`) lê os itens da foto com o [tesseract.js](https://github.com/naptha/tesseract.js). Os arquivos moram aqui, e não numa CDN: a CSP só deixa o próprio site, e o service worker guarda eles pra abrir sem rede. Nada daqui baixa até a pessoa tocar na 📷.

| arquivo | o que é | de onde | licença |
|---|---|---|---|
| `tesseract.min.js` | quem fala com o leitor, na página | tesseract.js 5.1.1 (`dist/`) | [Apache 2.0](LICENSE-tesseract.js.md) |
| `worker.min.js` | o leitor, num worker | tesseract.js 5.1.1 (`dist/`) | [Apache 2.0](LICENSE-tesseract.js.md) |
| `tesseract-core-simd-lstm.wasm.js` | o tesseract em wasm (só o motor LSTM, com SIMD) | tesseract.js-core 5.1.1 | Apache 2.0 |
| `por.traineddata.gz` | o português | [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) (`por.traineddata`, gzip) | Apache 2.0 |

Só tem o motor com SIMD: celular sem SIMD no wasm (iPhone antes do iOS 16.4, Chrome antes do 91) não lê, e o app diz isso.

A licença do resto do projeto é a [MIT](../LICENSE) e não vale pra estes arquivos.

## Quanto acerta

Medido antes de entrar, com o tesseract.js lendo 30 contas de bar geradas no jeito da impressora térmica (fotografadas de dia, à noite com luz âmbar, tremidas, com flash e desbotadas) e 10 cupons térmicos reais escaneados. "Preços" é quantos totais de linha ele leu certo; foto noturna é simulada.

| foto | preços (cinza) | preços (mais contraste) | total da conta |
|---|---|---|---|
| dia | 98% | 86% | sempre |
| noite, luz âmbar | 50% | 64% | nunca |
| noite, tremida | 34% | 77% | nunca |
| flash | 68% | 64% | 1 em 6 |
| noite, papel desbotado | 5% | 20% | nunca |

Ampliar a foto não ajudou. À noite ele às vezes lê um número errado sem avisar (628,70 vira 625,70; 168,00 vira 68,00): por isso a soma fica escrita no cartão, pra pessoa conferir com a conta. Leitura: de 1 a 2 s por foto no computador (de 3 a 8 s no "mais contraste"); no celular, o cartão da foto mostra quanto levou.

## Os itens da conta

O leitor não procura mais só o preço solto: o app lê a conta linha a linha e monta cada item com nome, quantidade e valor (`achaItens()` no `app.js`). Conta de bar vem de dois jeitos:

- o nome numa linha e `6 UND x 18,90  113,40` na de baixo (a pré-conta);
- tudo numa linha só, com o número do item e o código do produto na frente e o código do imposto colado no valor (`2 41015 Pao Semolina Gde 2 x 10,90 06T 21,80G`, o cupom fiscal).

A impressora às vezes come o último dígito da coluna da direita (`113,4`). Por isso o valor do item é quantidade × unitário, e o número da direita só confirma a quantidade: o leitor lê o 1 como 7, e 7 × 32,90 não começa com 32,9. Item a quilo (`0,374 kg X 9,90`) também sai assim. O serviço vem do `(10%)` impresso ou, no cupom fiscal, do `acréscimo`.

Antes de ler, a foto é endireitada (até 12° pra cada lado). O leitor lê a conta como um bloco só, linha a linha (`tessedit_pageseg_mode` 6): no automático, a coluna dos totais virava um bloco à parte e ele acertava de 1 a 4 itens em vez de 4. Foto com menos de 1000 de largura (cupom escaneado, foto que o zap encolheu) é lida duas vezes, no tamanho dela e aumentada, e fica a leitura que bate com o TOTAL. Aumentar a foto grande só piora.

As contas de verdade que medem isso estão em `specs/contas/`, e `npm run contas` mede de novo. Hoje 4 das 5 fecham no total impresso, e o CI confere essas 4. Com as fotos estragadas de propósito (`--variacoes`: escura, tremida, torta e encolhida), 14 das 25 fecham. O que mais erra é o nome do item (HOSCOW MULE), e não o valor. Lendo só o preço solto, como era antes, o 60,00 e o 113,40 da conta do Bar do Caranguejo nunca saíam.

Trocar de versão: `npm i tesseract.js@<versão>` numa pasta qualquer e copiar os quatro de novo, dos mesmos lugares.
