# Roteiro de QA do tô lisa

Sessão de QA é gente de verdade usando o site no celular dela, com alguém do lado olhando e **sem ajudar**. O que interessa é onde a pessoa trava, não se ela chega no fim. Cada sessão segue o mesmo roteiro, pra dar pra comparar uma com a outra.

## Antes de começar

- Anote o aparelho (modelo, tamanho da tela), o sistema e o navegador com a versão. Um Safari antigo e o do iOS 26 mudam o caminho de instalar, por exemplo.
- Aparelho limpo pro site: aba anônima, ou apague os dados do `tolisa.com.br`. Senão contam as visitas anteriores e o site pula convites que só aparecem na primeira vez.
- Não explique nada. Diga só: "é pra dividir conta com os amigos, faz o que eu for pedindo".
- Quem observa anota **onde a pessoa tocou**, e não só o que ela conseguiu fazer. Toque errado é o dado mais valioso da sessão.

## O roteiro

Peça um passo por vez, na ordem, com as palavras de quem usa, e não com os nomes da interface ("anota que você pagou a pizza", e não "toque no ✎").

1. **Criar um evento.** Abra `tolisa.com.br` e crie um evento com um código qualquer.
2. **Pôr gente no evento.** Adicione três pessoas, você e mais duas.
3. **Dizer quem é você.** Escolha o seu nome.
4. **Dividir uma conta igualmente.** "Você pagou R$ 90 de pizza pros três."
5. **Dividir uma conta em partes diferentes.** "Fulano pagou R$ 50 de Uber; você deve 30 e o outro, 20."
6. **Cadastrar a chave pix.** Deixe a pessoa escolher a chave que quiser. Se ela tentar CPF ou telefone, observe se entende por que não passou.
7. **Ver no que gastou.** "Mostra os gastos que vocês anotaram."
8. **Ver quem deve pra quem.** "Quanto você deve, e pra quem?"
9. **Trocar de pessoa.** "Agora você é o fulano."
10. **Pagar uma dívida pelo pix.** Copiar o pix, "pagar" (não precisa pagar de verdade) e marcar como pago.
11. **Avisar quem recebeu.** Mandar a mensagem de quitação pro outro.
12. **Mandar o resumo no zap.** Compartilhar o evento pelo zap.
13. **Instalar na tela de início.** "Deixa ele como app no seu celular."
14. **Sair e voltar.** Feche cartões e telas do jeito que a pessoa achar melhor, e veja se ela sabe voltar.

## Durante

- Cronometre de leve: passo que passa de ~30 s é travamento, e merece anotação.
- Anote a frase que a pessoa solta ("cadê?", "isso aqui é botão?"). Costuma ser o melhor nome pro problema.
- Se ela ignorar um aviso, anote o aviso e onde ele estava na tela.
- Deixe errar. Só ajude quando ela desistir, e anote que precisou de ajuda.

## Depois

Abra uma issue com o rótulo `enhancement`, título `feedback - <quem> (QA)`, com o aparelho, o passo em que travou, onde tocou e a frase que disse. Um problema por item, numerado. Ideias de solução são bem-vindas, mas separadas do que aconteceu.

## O que as sessões já acharam

### #35 · iPhone de tela grande

- O ✎ lá embaixo não foi achado. Ela tocou na caixa tracejada "nada anotado ainda" e no balão âmbar em cima do botão, não no botão. **Feito:** o ✎ e o zap subiram pro canto de cima à direita, e a caixa do caderno em branco abre o anotar.
- O zap também não foi achado. **Feito:** foi junto com o ✎.
- A lista de itens não foi achada. **Feito:** a linha tem moldura o tempo todo e diz "ver os 3 itens" até abrir a primeira vez.
- O balão explicando o ✔ confundiu, principalmente sem chave pix. **Feito:** os botões dizem o que fazem ("✔ paguei", "copiar pix") e o balão saiu.
- Tocar fora pra fechar não é óbvio. **Feito:** o cartão do evento ganhou um botão voltar.
- O cartão de instalar no iPhone não batia com o Safari dela (só os •••). **Feito:** passo a passo do iOS 26. Instalar com um toque não dá: o Safari não tem API pra isso.
- Segurar a ficha selecionava o texto atrás. **Feito:** a ficha cancela o toque longo do iPhone.
- Cadastrou CPF como chave: o aviso sumiu num toast no pé da tela e ela nem viu. **Feito:** CPF e telefone barrados no próprio cartão, que não fecha, com o recado e a caixa em vermelho.
