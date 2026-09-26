# tô lisa · quem me deve?

Divisor de gastos entre amigos, no estilo do Splitwise, sem aplicativo e sem cadastro. É um site estático (HTML, CSS e JavaScript, sem build) publicado em [tolisa.com.br](https://tolisa.com.br/), com os dados no Firebase Realtime Database.

## Como usar

1. Abra o site e digite um nome para o evento. O evento novo recebe um final sorteado no código (`churras-k7f3q9x2`), então compartilhe o link, não só o nome.
2. Em "quem é você?", escolha seu nome.
3. Anote os gastos no ✎: valor, descrição, quem pagou e quem divide. A divisão pode ser igual ou em partes diferentes. Desmarcar quem pagou registra um empréstimo.
4. **Minha conta** mostra quanto você deve ou tem a receber. É ali que você marca um pagamento como feito (✔) e copia o Pix já com o valor. **Falta pagar** mostra o menor número de transferências que zera todo mundo.
5. **Enviar** gera a imagem da conta e abre o WhatsApp com a lista de quem paga quem e o link do evento.

No celular, o site pode ser instalado pelo botão do rodapé e abre sem internet com a última versão carregada.

## Dados e segurança

- Cada evento fica em `rooms/<sha256(código)>`. Quem tem o código lê e escreve; ninguém consegue listar os eventos, porque a raiz `rooms` não é legível. O final sorteado (36⁸ possibilidades) impede que um código curto seja adivinhado testando hashes direto no banco. Dentro do evento, todos os dados são visíveis para quem tem o link.
- A chave Pix fica em `pix/<evento>/<pessoa>/key`. Todos leem; só o aparelho que cadastrou pode trocá-la, porque guarda um segredo (`tok`) no navegador. Se esse aparelho for perdido, apague o nó no console do Firebase.
- Qualquer pessoa do evento pode cadastrar uma chave em nome de quem ainda não cadastrou. Confira o nome do recebedor no aplicativo do banco antes de confirmar um Pix.
- Tudo que vem do banco é tratado como não confiável: ids são filtrados, textos são escapados, e o `index.html` tem uma Content-Security-Policy.

### Regras do banco

As regras ficam em [`database.rules.json`](database.rules.json) e são coladas no console do Firebase (Realtime Database → Regras). Antes de publicar, teste no simulador de regras com uma sala copiada do banco.

- O `.read` fica dentro de `$room`, nunca em `rooms`. As regras se propagam para baixo e não podem ser revogadas num nível mais fundo: com `.read` em `rooms`, um `GET /rooms.json` baixaria o banco inteiro.
- O `.validate` de `rooms/$room` repete o formato que o `clean()` do `app.js` produz: sem campos extras, textos no tamanho do app, até 1000 pessoas, 10000 itens e 1000 exclusões. Quem mudar o `clean()` precisa mudar as regras e o `specs/_banco.cjs`, que as reproduz nos testes.

## Desenvolvimento

Não há build: `python3 -m http.server` na raiz e abra o endereço. A lógica está em `app.js` (verificada por `// @ts-check`, com `npm run types`), o estilo em `style.css`, e a URL do banco é a constante `DB` no topo do `app.js`.

Os testes são cenários do Cucumber em português, escritos como especificação:

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

Os cenários ficam em `specs/features/` e os passos em `specs/passos/`. Para ver uma mudança visual, `node specs/preview.cjs '#settle'` gera um recorte com dados de exemplo.

A `main` é publicada no GitHub Pages pelo workflow `pages.yml`. Antes de contribuir, leia o [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

O código é [MIT](LICENSE). As fontes em `fonts/` têm licenças próprias: VT323 é SIL OFL 1.1 e Permanent Marker é Apache 2.0 (detalhes em [fonts/README.md](fonts/README.md)).
