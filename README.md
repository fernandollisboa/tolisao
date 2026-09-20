# Racha

Divisor de gastos estilo Splitwise, mínimo. Um único HTML, sem backend pra manter, sem conta, sem app.

**Site:** https://fernandollisboa.github.io/splitwise-lite/

## Como funciona

1. Abra o site e digite o **código do grupo** (ex.: o combinado no zap). Pronto, você está dentro.
2. Escolha seu nome em "Quem é você?".
3. Lance gastos: dividido igualmente (deixe o pagador marcado) ou empréstimo (desmarque o pagador e deixe só quem deve).
4. **Acerto de contas** mostra o mínimo de pix pra zerar todo mundo.

Pra convidar alguém: manda o link do site e o código. Um código que ainda não existe cria um grupo novo (a página pergunta antes).

## Onde ficam os dados

Num **Firebase Realtime Database** (plano gratuito), acessado direto do navegador pela API REST.
Cada grupo fica em `rooms/<sha256(código)>`. A URL do banco está na constante `DB` do `index.html`.
Os clientes mesclam por id e atualizam a cada 6s, então edições simultâneas de celulares diferentes não se sobrescrevem.

Regras do banco (Realtime Database → Regras):

```json
{ "rules": { "rooms": { "$room": { ".read": true, ".write": true } } } }
```

Quem tem o código lê e escreve no grupo. Não guarde nada sensível.

## Deploy

GitHub Pages publica a branch `main` via `.github/workflows/pages.yml`.
