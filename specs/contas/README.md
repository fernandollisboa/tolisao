# Contas de verdade

Fotos de contas de bar e restaurante pra medir o leitor da foto da conta (o 📷 do anotar, atrás do `?mesa`). Cada conta tem três arquivos:

- `<nome>.jpg`: a foto, sem os dados do celular (EXIF, com o GPS).
- `<nome>.json`: o que a conta tem de verdade. `itens` (nome, `qtd` e `valor` de cada um, como está impresso), `servico` (o valor dos 10%, ou `null`), `total` e `fonte` (de onde veio, quando e como foi tirada).
- `<nome>.lido.json`: o que o leitor leu da foto, uma leitura por vez (a foto pequena é lida duas). É gerado, não se edita.

## Medir

`npm run contas` lê todas com o leitor de verdade, no app de verdade, e diz, por conta:

- quantos itens saíram com o valor certo;
- quantos com o nome parecido;
- o que veio a mais;
- o serviço;
- se a soma bateu com o TOTAL lido;
- se o "usar", com todo mundo em tudo, dá o total da conta.

`npm run contas -- frango` mede só as que têm "frango" no nome. `--variacoes` lê também cada foto escura, tremida, torta e encolhida como o zap faz.

## Pôr uma conta nova

1. A foto vai aqui como `<nome>.jpg`. Tire os dados do celular antes: `python3 -c "from PIL import Image, ImageOps; ImageOps.exif_transpose(Image.open('in.jpg')).convert('RGB').save('<nome>.jpg', quality=85)"`. Foto de celular, encolha pra uns 1500 de largura.
2. Escreva o `<nome>.json` olhando a conta (o `caranguejo.json` é o modelo).
3. `npm run contas -- <nome> --grava` mede e guarda o `<nome>.lido.json`.
4. Se a conta fecha no total, ponha o nome nos `Exemplos` do "a conta fecha" do `specs/features/foto.feature`. Assim o CI garante que ela continua fechando, sem rodar o leitor. Se não fecha, ela fica aqui do mesmo jeito: é o próximo caso pra ensinar o leitor.

Mudou o `preparaFoto()` (como a foto chega no leitor)? Grave de novo todas (`npm run contas -- --grava`): a leitura muda junto.

## O que tem hoje

| conta | formato | valores | fecha no total |
|---|---|---|---|
| `caranguejo` | pré-conta da Linx Menew, nome numa linha e `6 UND x 18,90` na de baixo, coluna da direita cortada; foto de celular à noite | 4/4 | sim |
| `frango-assado` | cupom fiscal (ECF), item numa linha só: `2 41015 Pao Semolina Gde 2 x 10,90 06T 21,80` | 5/5 | sim |
| `alimentacao-consciente` | cupom fiscal, serviço como `acréscimo +0,55` | 1/1 | sim |
| `pao-a-quilo` | cupom fiscal, item a quilo: `0,374 kg X 9,90` | 1/1 | sim |
| `joakins` | cupom fiscal da Colibri, letra condensada que o leitor não pega | 1/3 | não |

As quatro de 2015 vêm escaneadas do [nfscan/ocr-process-service](https://github.com/nfscan/ocr-process-service), sob a licença MIT: "Copyright (c) 2015 Paulo Miguel Almeida Rodenas". Não achamos um banco aberto de contas brasileiras de restaurante; conta nova vem de foto.
