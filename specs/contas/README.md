# Contas de verdade

Fotos de conta tiradas no bar, cada uma com o gabarito do lado: o que está escrito no papel. É a régua do leitor da foto (o 📷 do anotar, `ocr/`): mexeu no `preparaFoto`, no `achaItens`, no `achaPrecos` ou no jeito de chamar o tesseract, rode antes e depois e compare.

```sh
npm run ocr                # todas, lidas em cinza e com mais contraste
npm run ocr -- xmenu       # só as que têm "xmenu" no nome
npm run ocr -- --detalhe   # o que ele achou, o que faltou e o que inventou, conta por conta
```

Não é teste e não roda no CI: o leitor de verdade leva segundos por foto. A tabela diz, por conta e por jeito de ler:

- **itens**: quantos totais de item viraram preço tocável (o unitário apagado não conta);
- **nome**: quantos desses vieram com o nome certo (o lido contém o da conta, sem acento nem pontuação);
- **total**: se ele achou o total da conta;
- **inventou**: preço que não está em lugar nenhum do papel (1 UND lido como 7, 16,00 lido como 18,00).

## Pôr uma conta nova

1. A foto do jeito que o celular tirou, sem cortar nem girar: é o que a pessoa manda no app. Sem a localização (o GPS do EXIF); ficam marca, modelo, data e a orientação, que o navegador usa pra desvirar:

```sh
python3 - foto.jpg specs/contas/AAAA-MM-DD-lugar.jpg <<'PY'
import sys
from PIL import Image
i = Image.open(sys.argv[1]); velho = i.getexif(); novo = Image.Exif()
for k in (271, 272, 274, 306):  # marca, modelo, orientação, data
    if k in velho: novo[k] = velho[k]
i.save(sys.argv[2], quality='keep', exif=novo.tobytes())
PY
```

2. Do lado, o `.json` de mesmo nome, com o que está no papel. Dinheiro em centavos:

```json
{
  "onde": "onde foi",
  "como": "luz, mão, papel, e o que essa conta tem de difícil",
  "itens": [{ "nome": "BUDWEISER 600ML", "qtd": 6, "un": 1890, "total": 11340 }],
  "servico": 1792,
  "total": 25712,
  "outros": [17920, 12856]
}
```

`itens` na ordem do papel, um por linha da conta (item repetido aparece duas vezes). O `un` só quando o papel imprime o unitário. `outros` são os preços que estão no papel e não são item: subtotal, valor por pessoa, couvert separado. Sem eles, o que o leitor achar ali conta como inventado.

As fotos não vão pro site (o `pages.yml` tira esta pasta).

## O que já se mediu

30/10/2026, com o leitor do PR #341 (bloco único, "qtd x unitário"):

| conta | modo | itens | nome | total | inventou |
|---|---|---|---|---|---|
| 2026-10-23-caranguejo | cinza | 3/4 | 2/4 | não | 1 |
| 2026-10-23-caranguejo | contraste | 4/4 | 2/4 | não | 0 |
| 2026-10-29-xmenu | cinza | 6/9 | 0/9 | sim | 4 |
| 2026-10-29-xmenu | contraste | 3/9 | 0/9 | sim | 4 |
| 2026-10-30-oxemenu | cinza | 6/6 | 0/6 | sim | 0 |
| 2026-10-30-oxemenu | contraste | 1/6 | 0/6 | não | 0 |

- **caranguejo**: o total de cada item e o TOTAL saem cortados na beirada (`257,1(`); os itens vêm do "qtd x unitário". Em cinza o "1 UND x 32,90" do Moscow Mule vira 7 (230,30).
- **xmenu**: conta em colunas (PRODUTO, QTDE, PRECO, VALOR), sem o "x", com ponto no decimal. O leitor só vê preço solto: não dá nome a nenhum, apaga o unitário de uns e não de outros, e troca 0 por 6 e 6 por 8 (19,06, 18,00). Nome de item quebra em duas linhas.
- **oxemenu**: a quantidade vem antes do nome (`9 CERVEJA ORIGINAL 600ML  R$ 126,00`), sem unitário. Em cinza ele acha todos os preços, mas nenhum com nome (só o `qtd x unitário` dá nome). Com mais contraste, a sombra do dedo e o flash apagam quase tudo: só sobram 4,00 e o subtotal.
