# tô lisa · quem me deve?

tipo Splitwise, só que sem app e sem cadastro 👍

JavaScript, HTML e CSS. e só 👨‍🎨 https://tolisa.com.br/

## como usa

1. abre o site e digita um nome pro evento. evento novo ganha um final sorteado no código (`churras-k7f3q9x2`): mande o link no zap, que é por ele que o pessoal entra.
2. diz quem você é em "quem é você?".
3. anota os gastos no ✎: valor, o quê, quem pagou e quem divide. dá pra dividir em partes diferentes ou emprestar (desmarca o pagador).
4. **Minha conta** diz quanto você deve ou tem a receber, e é de lá que você age: ✔ quita, copiar pix já vai com o valor. **Falta pagar** só mostra o mínimo de transferências pra zerar todo mundo.
5. **enviar** gera a imagem da comanda e abre o zap com quem paga quem.

pra chamar alguém: o texto do **enviar** já leva o link do evento. no celular dá pra instalar (botão no rodapé), e abre offline com a última versão vista.

## dados e segurança

- cada evento fica em `rooms/<sha256(código)>`. quem tem o código lê e escreve; quem não tem não acha, porque ninguém lê a raiz `rooms`. o hash sozinho não impede adivinhar um código curto testando direto no banco, por isso o final sorteado (36⁸ possibilidades). mesmo assim, nada sensível: dentro do evento tudo é aberto.
- a chave pix fica em `pix/<evento>/<pessoa>/key`. todo mundo lê, só o aparelho que cadastrou troca (um segredo `tok` fica no navegador dele). perdeu o aparelho? apaga o nó no console do Firebase.
- qualquer um cadastra chave em nome de quem ainda não cadastrou. então: **confere o nome do recebedor no banco antes de confirmar o pix.**
- tudo que vem do banco é hostil: id filtrado, texto escapado.

regras do banco (Realtime Database → Regras):

o `.validate` de `rooms/$room` é o formato que o `clean()` do `app.js` produz: quem acha o código ainda escreve na sala, mas só uma sala de verdade, sem campo a mais, texto gigante ou lista sem fim (até 1000 pessoas, 10000 itens, 1000 exclusões). mexeu no `clean()`, mexa aqui e no `specs/_banco.cjs`, que imita estas regras nos testes. antes de publicar no console, teste no simulador de regras com uma sala copiada do banco.

> **o `.read` fica dentro do `$room`, nunca em `rooms`.** as regras cascateiam e não dá pra revogar mais fundo: com `.read` em `rooms`, um `GET /rooms.json` baixa o banco inteiro e o hash do código não vale mais nada.

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": true,
        ".write": true,
        ".validate": "$room.matches(/^[0-9a-f]{64}$/) && newData.hasChildren(['v', 'updatedAt'])",
        "v": { ".validate": "newData.val() === 2" },
        "name": { ".validate": "newData.isString() && newData.val().length <= 40" },
        "updatedAt": { ".validate": "newData.isNumber()" },
        "people": {
          "$i": {
            ".validate": "$i.matches(/^[0-9]{1,3}$/) && newData.hasChildren(['id', 'name'])",
            "id": { ".validate": "newData.isString() && newData.val().matches(/^[a-z0-9]{1,32}$/)" },
            "name": { ".validate": "newData.isString() && newData.val().length <= 30" },
            "at": { ".validate": "newData.isNumber()" },
            "$outro": { ".validate": false }
          }
        },
        "expenses": {
          "$i": {
            ".validate": "$i.matches(/^[0-9]{1,4}$/) && newData.hasChildren(['id', 'amount', 'payer', 'among'])",
            "id": { ".validate": "newData.isString() && newData.val().matches(/^[a-z0-9]{1,32}$/)" },
            "desc": { ".validate": "newData.isString() && newData.val().length <= 60" },
            "amount": { ".validate": "newData.isNumber() && newData.val() > -10000000000 && newData.val() < 10000000000" },
            "payer": { ".validate": "newData.isString() && newData.val().matches(/^[a-z0-9]{1,32}$/)" },
            "among": {
              "$j": { ".validate": "$j.matches(/^[0-9]{1,2}$/) && newData.isString() && newData.val().matches(/^[a-z0-9]{1,32}$/)" }
            },
            "at": { ".validate": "newData.isNumber()" },
            "kind": { ".validate": "newData.val() === 'payment'" },
            "by": { ".validate": "newData.isString() && newData.val().length <= 30" },
            "shares": {
              "$p": { ".validate": "$p.matches(/^[a-z0-9]{1,32}$/) && newData.isNumber() && newData.val() >= 0" }
            },
            "$outro": { ".validate": false }
          }
        },
        "deleted": {
          "$i": { ".validate": "$i.matches(/^[0-9]{1,3}$/) && newData.isString() && newData.val().matches(/^[a-z0-9]{1,32}$/)" }
        },
        "$outro": { ".validate": false }
      }
    },
    "pix": {
      "$room": {
        "$person": {
          ".write": "!data.exists() || data.child('tok').val() === newData.child('tok').val()",
          ".validate": "newData.hasChildren(['key','tok']) && newData.child('key').isString() && newData.child('key').val().length <= 80 && newData.child('tok').isString()",
          "key": { ".read": true }
        }
      }
    }
  }
}
```

## desenvolver

sem build: `python3 -m http.server` e abre. lógica em `app.js` (`// @ts-check`, `npm run types` confere), estilo em `style.css`, a URL do banco é o `DB` no topo do `app.js`.

testes são cucumber em português, lidos como especificação:

```sh
npm ci && npx playwright install chromium
npm test
```

```gherkin
Cenário: quitar e avisar no zap
  Quando eu abro o evento como Lia
  E eu quito a primeira linha de Minha conta e aviso no zap
  Então o zap abre com a mensagem:
    """
    ✅ Fernando, te paguei R$ 117,84 do *bailedamada* 👍
    {link do evento}
    """
```

os cenários ficam em `specs/features/`, os passos em `specs/passos/`. mudou a tela? `node specs/preview.cjs '#settle'` tira um recorte com dados de exemplo.

push na `main` publica no GitHub Pages. antes de mandar mudança, lê o [CONTRIBUTING.md](CONTRIBUTING.md).

## licença

[MIT](LICENSE). pega e usa.

as fontes em `fonts/` não: VT323 é SIL OFL 1.1 e Permanent Marker é Apache 2.0, cada uma com a licença do lado ([fonts/README.md](fonts/README.md)).
