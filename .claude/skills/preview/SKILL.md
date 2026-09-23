---
name: preview
description: Gera e envia preview visual do Tô Lisa. Use SEMPRE que mexer em algo que aparece na tela (CSS, layout, cor, texto de interface, botão, carimbo, animação, recibo, cartões do overlay) e sempre que for oferecer opções de design pro usuário escolher. Dispara em pedidos como "muda a cor", "aumenta o botão", "me dá opções", "ideias de", "tá feio", "me dá preview".
---

# Preview do Tô Lisa

O usuário não lê diff, ele olha. Toda mudança visual termina com uma imagem enviada por `SendUserFile`, sem ele precisar pedir.

## Como gerar

O gerador fica em `tests/preview.cjs` e sobe o app com dados falsos (cinco pessoas com nomes de tamanhos diferentes, item dividido em partes desiguais, uma quitação já feita).

```sh
node tests/preview.cjs '#mine'                      # recorte de uma seção
node tests/preview.cjs '#settle' --quem=Fernando    # quem você está vendo como
node tests/preview.cjs --saida=/tmp/tudo.png        # página inteira
node tests/preview.cjs --recorte=0,0,390,240        # pedaço por coordenadas (cabeçalho, rodapé)
node tests/preview.cjs '#settle' --variantes=/tmp/v.cjs --saida=/tmp/opts.png
```

Seletores úteis: `#mine`, `#itemsSec`, `#settle`, `#app`, `#overlay .paper`.
Como módulo, `preview({ alvo, quem, pix, dados, variantes, saida })` aceita dados próprios quando o caso precisa de outro cenário.

## Animação vai de vídeo

Quadro congelado não mostra movimento. Pra qualquer coisa que se mexe (risco, ficha, botão que brota, fade), grave:

```sh
node tests/video.cjs pix                        # o copiar pix saindo de trás do ✔
node tests/video.cjs ficha --saida=/tmp/f.webm  # a ficha caindo no rodapé
node tests/video.cjs risco --vel=0.35           # o risco correndo nas linhas pagas
```

`--vel` é a velocidade das animações (0.35 = bem devagar). Cena nova? Acrescente em `CENAS`, no topo do arquivo: cada uma diz quem você é, quanto o pix demora e o que a câmera faz. Mande o `.webm` com `SendUserFile`.

## Opções de design

Quando for propor alternativas, monte um arquivo de variantes e mande UMA folha comparativa, nunca uma imagem por opção:

```js
module.exports = {
  A: { nome: 'como está' },
  B: { nome: 'carimbo no meio', css: '.stamp{left:50%}' },
  C: { nome: 'sem moldura', css: '.stamp{border:0}', js: `document.querySelector('.stamp').textContent='pago'` },
};
```

Cada variante pode ter `css` e `js`; a folha sai rotulada com a letra e o nome. Depois de escolhida, implemente de verdade no `app.js`/`style.css` e mande o preview do resultado.

## Regras

- **Tamanho real.** A folha usa a largura de tela de verdade. Nunca encolha a imagem pra caber mais coisa, senão o preview mente e o usuário reclama, com razão.
- **Celular primeiro.** Padrão é 390 de largura. Se a mudança afeta desktop, mande também com `--largura=1440`.
- **Estado que importa.** Escolha `--quem` de quem enxerga o que você mexeu: quem deve vê os botões de quitar e copiar pix, quem recebe vê a lista de quem deve.
- **Antes e depois.** Em ajuste de espaçamento, alinhamento ou cor, mostre as duas versões lado a lado usando uma variante com o CSS antigo.
- **Recibo.** Pra imagem do WhatsApp, use `tests/img.cjs`, que baixa o PNG gerado pelo canvas; o preview do navegador não cobre isso.
- **Legenda curta.** Ao enviar, diga em uma linha o que olhar na imagem.
