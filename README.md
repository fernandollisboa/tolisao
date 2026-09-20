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

Cada grupo é um documento JSON no [jsonblob.com](https://jsonblob.com), grátis e sem conta. Um índice compartilhado
(`ROOT_ID` no `index.html`) mapeia o hash do código para o documento do grupo. Os clientes mesclam por id e atualizam a cada 6s,
então edições simultâneas de celulares diferentes não se sobrescrevem.

Limitações: o jsonblob apaga documentos que ninguém abre por 30 dias (a página detecta e oferece restaurar da cópia local).
Use **Exportar JSON** como backup.

## Primeira configuração

Com `ROOT_ID` vazio, a primeira pessoa a digitar um código cria o índice e a página mostra o id. Cole-o em `ROOT_ID` e faça push.

## Deploy

GitHub Pages publica a branch `main` via `.github/workflows/pages.yml`.
