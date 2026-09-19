# Racha

Divisor de gastos estilo Splitwise, mínimo. Um único HTML, sem backend pra manter, sem conta, sem app.

**Site:** https://fernandollisboa.github.io/splitwise-lite/ (código de acesso combinado no grupo)

## Como funciona

1. Abra a página, digite o código, crie um grupo e seu nome.
2. Toque em **Copiar link do grupo** e mande pros amigos.
3. Quem tiver o link vê os mesmos gastos e adiciona os seus. Sincroniza a cada poucos segundos.

### Tipos de gasto

- **Dividido igualmente**: deixe o pagador marcado entre os participantes (ex.: jantar pra 3 → cada um deve um terço).
- **Empréstimo / uma pessoa deve**: desmarque o pagador e deixe só quem deve (ex.: "Lia me deve R$ 12").

**Acerto de contas** mostra o mínimo de transferências pra zerar todo mundo.

## Onde ficam os dados

Cada grupo é um documento JSON no [jsonblob.com](https://jsonblob.com) (grátis, sem conta, id aleatório por grupo; o link é o segredo).
Os clientes mesclam por id, então edições simultâneas de celulares diferentes não se sobrescrevem.

Limitações:

- O jsonblob apaga documentos que ninguém abre por 30 dias. A página detecta isso e oferece restaurar da cópia local.
- Use **Exportar JSON** como backup.

## Deploy

GitHub Pages publica a branch `main` via `.github/workflows/pages.yml`.
Na primeira vez: Settings → Pages → Source: **GitHub Actions**, depois rode o workflow de novo.
