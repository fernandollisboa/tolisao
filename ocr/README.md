# Leitor da foto da conta

O 📷 do anotar (protótipo do modo mesa, liga no aparelho com `?mesa`) lê os preços da foto com o [tesseract.js](https://github.com/naptha/tesseract.js). Os arquivos moram aqui, e não numa CDN: a CSP só deixa o próprio site, e o service worker guarda eles pra abrir sem rede. Nada daqui baixa até a pessoa tocar na 📷.

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

Trocar de versão: `npm i tesseract.js@<versão>` numa pasta qualquer e copiar os quatro de novo, dos mesmos lugares.

## Conta de restaurante

Na conta da impressora térmica, o total de cada item fica na beirada e sai cortado (`60,0(`, `113,4(`): o leitor nem vê preço ali. Por isso o app lê a foto como um bloco só, linha a linha (`tessedit_pageseg_mode` 6; no automático a coluna dos totais virava um bloco à parte e se perdia), e a linha "6 UND x 18,90" vira um item de 113,40, a quantidade vezes o unitário, com o nome da linha de cima. Na conta do Bar do Caranguejo (foto de 23/10/2026, à noite, na mão), os quatro itens saíram certos e a soma bateu com o TOTAL.

As fotos de conta de verdade, com o gabarito de cada uma, ficam em [`specs/contas/`](../specs/contas/README.md): `npm run ocr` diz quanto o leitor acerta nelas.
