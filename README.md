# Tô Lisa(o) · quem me deve?

Tipo Splitwise, só que sem app e sem cadastro 👍

**Site:** https://fernandollisboa.github.io/splitwise-lite/ · **curto:** tinyurl.com/tolisao

Um HTML só, sem backend pra manter. Os dados ficam num Firebase Realtime Database (plano gratuito) acessado direto do navegador.

## Como usa

1. Abra o site e digite o **código do evento** combinado no zap. Código novo cria um evento (a página pergunta antes).
2. Diga quem você é em "Quem é você?". Ali também dá pra cadastrar sua **chave Pix** (aleatória ou e-mail).
3. Anote os gastos pelo ✎: valor, o quê, quem pagou e quem divide. Dá pra dividir em partes diferentes ou marcar como empréstimo (desmarque o pagador).
4. **Minha conta** mostra quanto você deve ou tem a receber. **Acerto** mostra o mínimo de transferências pra zerar todo mundo, com botão de copiar o Pix já com o valor e o botão de quitar.
5. **Enviar** gera a imagem da comanda e abre o WhatsApp com o resumo de quem paga quem.

Pra convidar alguém: "copiar link do evento" e manda.

## Dados e segurança

- Cada evento fica em `rooms/<sha256(código)>`. Quem tem o código (ou o link) lê e escreve. A lista de eventos é pública por design: não guarde nada sensível.
- A chave Pix fica em `pix/<evento>/<pessoa>/key`, legível por todos, mas só o aparelho que cadastrou consegue trocar (um segredo `tok` fica no navegador dele e nas regras). Se perder o aparelho, apague o nó no console do Firebase.
- Qualquer pessoa pode cadastrar uma chave em nome de quem ainda não cadastrou. A proteção é a de sempre: **confira o nome do recebedor na tela do banco antes de confirmar o Pix.**
- Tudo que vem do banco é tratado como hostil (ids filtrados, textos escapados).

Regras do banco (Realtime Database → Regras):

```json
{
  "rules": {
    "rooms": { ".read": true, "$room": { ".write": true } },
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

## Desenvolver

Não tem build. Sirva a pasta com qualquer servidor estático (`python3 -m http.server`) e abra `index.html`. A URL do banco é a constante `DB` no topo do script.

Testes (Playwright, sem framework):

```sh
npm i -D playwright && npx playwright install chromium
node tests/run-all.cjs
```

Cada script sobe um servidor local, simula o Firebase e imprime o que checou. Screenshots vão pra pasta temporária do sistema.

Deploy: push na `main` publica via GitHub Pages (`.github/workflows/pages.yml`). Em pull request, `tests.yml` roda os testes.
