---
name: gherkin
description: Escreve e revisa cenários cucumber do tô lisa (specs/features/*.feature, em português). Use SEMPRE que for criar, mudar ou revisar um Cenário, um Contexto ou um passo em specs/passos/; quando uma mudança de comportamento no app.js pedir cenário novo; e quando o usuário pedir "testa isso", "põe um teste", "cobre esse bug", "escreve o cenário" ou perguntar se um teste "é de feature" ou "tá bem escrito".
---

# Cenário no tô lisa

O `.feature` é a especificação: quem não programa lê e entende o que o app faz. O passo em `specs/passos/*.cjs` é onde mora o como. Se a frase do cenário só faz sentido pra quem leu o `app.js`, ela está no lugar errado.

## As regras

1. **Diz o comportamento, não a implementação.** Nada de `PALETTE`, `localStorage`, `id`, seletor, nome de função, "gera". O banco aparece só no `Então`, quando o efeito combinado é ele ("o evento no banco tem…", "o banco guarda a chave…"), nunca no `Dado` nem no `Quando`. Pergunta-teste: a frase continua verdadeira se o código for reescrito do zero?
2. **Um comportamento por cenário.** O título diz a regra, como quem explica pra um amigo: "ninguém divide cor, por maior que seja a turma", não "teste de cores". Vários `Então` que retratam a mesma tela num mesmo momento são um comportamento só ("a nota de quem deve", em `acerto.feature`, confere valor, botões e subtítulo juntos, e tá certo: cada cenário abre um navegador e o CI tem que ser rápido). Separe quando o título deixa de dizer tudo que o cenário confere.
3. **`Dado` é estado, não caminho.** Monte o mundo direto ("Dado um evento de 12 pessoas"), em vez de clicar até ele ("abro o site, digito o código, crio o evento, ponho Ana, Bia…"). Clicar pra chegar só vale quando o caminho é o que está sendo testado: "evento de uma pessoa só não pergunta quem é você", em `evento.feature`, cria o evento pela tela de propósito, porque é a criação que ele confere. Esse não se "conserta".
4. **`Quando` é uma intenção da pessoa**, no vocabulário da tela: "eu toco em faltou gente", "eu quito a primeira linha". Se a intenção precisa de três cliques, o passo esconde os cliques; mas quem você é aparece na frase ("como Ana"), nunca fica escondido no passo. Alternar `Quando`/`Então`/`Quando` só quando a própria sequência é o comportamento (o Esquema do `pix.feature`: digita, barra, corrige, passa).
5. **`Então` é o que a pessoa vê** (texto, cor, botão, aviso, o link do zap) ou o que fica no banco quando isso é o efeito combinado. Nunca estado interno.
6. **Só o detalhe que importa.** Nome, valor e data aparecem quando mudam o resultado. Doze nomes listados só pra contar até doze é ruído: diga "12 pessoas". Valor que entra na conta, deixe na tabela, porque quem lê confere a soma.
7. **A descrição embaixo do `Cenário:` explica o porquê**, em uma ou duas frases de regra de produto ("código curto se adivinha testando o hash no banco"). Não conta como o código faz.
8. **Reaproveite antes de criar passo.** Procure em `specs/passos/` um passo que já diga a mesma coisa (`grep -n "Given\|When\|Then" specs/passos/*.cjs`) e leia os `defineParameterType` do `_mundo.cjs` (`{gente}`, `{num}`). **Cuidado:** `{gente}` engole qualquer texto, então uma frase nova parecida com um passo antigo pode cair nele sem erro ("o evento \"praia\" com 12 pessoas" vira uma pessoa chamada "12 pessoas"). Rode o cenário e confira que ele usa o passo que você quis. Passo novo tem frase de tela, e a parte técnica fica dentro dele.
9. **Fala do mesmo jeito que o app.** Português da tela, na pessoa do usuário ("eu"), com os nomes das seções como estão na tela: Minha conta, Falta pagar, Quem vai?, Quem é você?.

## Contexto, evento de exemplo e Esquema

- **`Contexto:`** só com o estado que todos os cenários do arquivo usam. Se um cenário precisa de outro mundo, ele vai pra outro arquivo ou monta o próprio `Dado`.
- **A festa padrão** é `Dado o evento de exemplo "bailedamada"` (`specs/_festa.cjs`). Quando os números entram na conta, repita a tabela no `.feature`, como em `acerto.feature`: quem lê confere a soma sem abrir outro arquivo.
- **`Esquema do Cenário:`** com `Exemplos:` quando a regra é a mesma e só o dado muda. A coluna que diferencia vira o título (`<tipo> não passa`).

## O que fica de fora

- Animação: não vira cenário (CLAUDE.md). Confere no vídeo (`specs/video.cjs`).
- Validação do banco: não vira cenário. É o `npm run regras`.
- Cenário que espera tempo: não existe. O relógio é falso (`AGORA` em `_mundo.cjs`); o passo avança o relógio, não espera.

## Exemplo

Ruim, porque descreve a implementação, monta o mundo clicando e lista nomes que não importam:

```gherkin
  Cenário: cada pessoa tem uma cor só dela, mesmo passando de 10
    A paleta tem 10 cores; da 11ª pessoa em diante a cor é gerada e não repete.
    Dado que eu abro o site sem evento
    Quando eu digito o código "praia"
    E eu crio o evento
    E eu ponho Ana, Bia, Caio, Duda, Edu, Fê, Gil, Hugo, Iara, Jão, Kika e Léo na lista
    Então as 12 pessoas da lista têm cores diferentes
```

Bom:

```gherkin
  Cenário: ninguém divide cor, por maior que seja a turma
    Cada pessoa é reconhecida pela cor dela na nota inteira: duas iguais confundem quem deve a quem.
    Vale também depois que acabam as cores de sempre.
    Dado um evento de 12 pessoas
    Quando eu abro o Quem vai? como Ana
    Então cada uma das 12 pessoas tem uma cor diferente
```

## Antes de entregar

- Leia o cenário em voz alta sem olhar o código. Faz sentido pra quem só usa o app?
- O cenário falha se a regra quebrar? Rode contra o código antigo ou desfaça a mudança e confira que fica vermelho.
- `npm test -- <arquivo>` verde, e `npm run qualidade` antes do PR.
