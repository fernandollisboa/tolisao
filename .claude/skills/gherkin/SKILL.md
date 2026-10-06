---
name: gherkin
description: Escreve e revisa cenários cucumber do tô lisa (specs/features/*.feature, em português). Use SEMPRE que for criar, mudar ou revisar um Cenário, um Contexto ou um passo em specs/passos/; quando uma mudança de comportamento no app.js pedir cenário novo; e quando o usuário pedir "testa isso", "põe um teste", "cobre esse bug", "escreve o cenário" ou perguntar se um teste "é de feature" ou "tá bem escrito".
---

# Cenário no tô lisa

O app é pequeno e a spec também. O `.feature` diz o que o app faz, pra quem só usa ele; o passo em `specs/passos/*.cjs` guarda o como. Tudo aqui é ideia pra ajudar, não lei: se o cenário fica mais claro quebrando uma, quebre.

Base: a doc oficial do Cucumber ([referência](https://cucumber.io/docs/gherkin/reference/), [better Gherkin](https://cucumber.io/docs/bdd/better-gherkin/), [BRIEF](https://cucumber.io/blog/bdd/keep-your-scenarios-brief/), [antipadrões](https://cucumber.io/docs/guides/anti-patterns/)).

## O jeito

- **O quê, não o como.** A pergunta da doc: "essa frase muda se a implementação mudar?" Se muda, ela tá no lugar errado. Nada de `PALETTE`, seletor, `localStorage`, "gera".
- **Uma regra por cenário, com título de gente.** "ninguém divide cor, por maior que seja a turma", não "teste de cores". Vários `Então` sobre a mesma tela tudo bem: cada cenário abre um navegador, e CI lento é pior.
- **Curto.** A doc sugere uns 3 a 5 passos e Contexto de até 4 linhas. Passou muito, talvez caiba um passo de nível mais alto.
- **`Dado` é estado, `Quando` é a ação da pessoa, `Então` é o que ela vê.** Monte o mundo direto ("Dado um evento com uma turma grande"), sem clicar até ele, a não ser que o caminho seja o próprio teste (o "evento de uma pessoa só" cria pela tela de propósito).
- **Só o dado que muda o resultado.** Concreto onde a conta é conferida (valores, datas, quem paga quem: deixe na tabela). Abstrato onde o número é só "muitos": "uma turma grande", e o 20 fica dentro do passo, com um comentário dizendo por quê. Pergunta de bolso: trocando esse dado por outro, a regra muda? Se não muda, é ruído.
- **Fala como a tela.** "eu", e os nomes das seções como aparecem: Minha conta, Falta pagar, Quem vai?, Quem é você?. A mesma ação, sempre com a mesma frase.
- **O porquê vai na descrição**, embaixo do título, em uma ou duas frases de produto. `#` é pra nota de quem mantém ("tabela repetida de propósito").
- **Banco no `Então` é exceção nossa.** A doc prefere o que a pessoa vê; aqui vale conferir o banco quando ele é o resultado combinado ("o evento no banco tem…"), nunca no `Dado` ou `Quando`.

## Ferramentas, quando caírem bem

- **`Regra:`** agrupa cenários de uma regra de negócio e pode ter o próprio `Contexto:`; debaixo dela, `Exemplo:` lê melhor que `Cenário:`. Bom quando só parte do arquivo usa a mesma montagem.
- **`Esquema do Cenário:` + `Exemplos:`** quando a regra é a mesma e só o dado muda (o `<tipo> não passa` do `pix.feature`).
- **`Contexto:`** só com o que todos os cenários (do arquivo ou da Regra) usam. A festa padrão é `Dado o evento de exemplo "bailedamada"` (`specs/_festa.cjs`); quando os números entram na conta, repita a tabela no `.feature`.
- **`Mas`** pra contraste ("Mas não aparece aviso"), `"""` pra texto longo (o zap, o cartão).

## Passos

- **Procure antes de criar**: `grep -n "Given\|When\|Then" specs/passos/*.cjs`. Achou um quase igual, use ou junte. Os passos são por assunto (evento, gasto, pix, aparelho), não por feature.
- **Um passo faz uma coisa.** "eu confirmo, e a página recarrega" são dois `E`.
- **Parâmetros:** `{word}`, `{string}`, `{int}`, `{num}` (valor em reais) e `{gente}` (só lista de nomes com maiúscula: "Ana, Bia e Caio"). Rode o cenário e confira que ele caiu no passo que você quis.
- **O `mundo` é por cenário.** Se um passo troca de evento, a frase diz ("eu entro no evento \"praia\"").

## Fica de fora

- Animação: confere no vídeo (`specs/video.cjs`), não em cenário.
- Validação do banco: `npm run regras`.
- Esperar tempo: o relógio é falso (`AGORA` em `_mundo.cjs`); o passo avança o relógio.

## Exemplo

```gherkin
  Cenário: ninguém divide cor, por maior que seja a turma
    Cada pessoa é reconhecida pela cor dela na nota inteira: duas iguais confundem quem deve a quem.
    Dado um evento com uma turma grande
    Quando eu abro o Quem vai?
    Então ninguém tem a mesma cor
```

A primeira versão dizia "Dado que eu abro o site sem evento / digito o código / crio o evento / ponho Ana, Bia, Caio… (12 nomes)" e "a paleta tem 10 cores": caminho no lugar de estado, nomes e número que não mudam a regra, e implementação na descrição.

## Antes de entregar

- Leia sem olhar o código: faz sentido pra quem só usa o app?
- Quebre a regra no código (ou volte a mudança) e veja o cenário ficar vermelho.
- `npm test -- <arquivo>` verde; `npm run qualidade` antes do PR.
