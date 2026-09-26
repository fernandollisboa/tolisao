---
name: babysit
description: Leva um PR do tô lisa até o ar - check verde, merge e deploy conferido. Use depois de abrir um PR, quando o usuário pedir "abre e sobe", "espera o verdin", "cuida do PR", ou quando chegar evento de CI ou review num PR acompanhado.
---

# Babysit do tô lisa

Abriu o PR, ele é seu até o site estar no ar. O usuário não quer ser chamado pra apertar botão: escolheu, tá aprovado (veja **deploy** no `CLAUDE.md`).

## Antes de subir

- `npm run types` limpo e `npm test` verde, na máquina, antes de cada push. Um push validado vale mais que três no chute.
- Mudança visual: suba o `?v=` do `index.html` (data + letra) e mande o preview antes.

## Esperando o check

- O check que importa é o `test` do `tests.yml`. Ele roda em `pull_request` pra `main`, e demora alguns segundos pra aparecer depois do push.
- Não fique perguntando de minuto em minuto. Arme um `Monitor` que consulta
  `https://api.github.com/repos/fernandollisboa/tolisao/commits/<sha>/check-runs`
  a cada 30s e sai quando `test` estiver `completed`, com o `conclusion` que vier.
- Vermelho é trabalho agora: leia o log (`get_job_logs`), reproduza local, corrija a causa e suba. "Instável" não é causa. Nunca pule, desligue ou apague teste pra ficar verde, e nunca mande commit vazio pra rodar de novo.
- Teste novo não pode deixar o CI lento. Cenário que precisa esperar animação não entra: animação se confere no vídeo.

## Verde

1. Merge com `merge`, apague a branch.
2. `git checkout main && git pull origin main`.
3. Espere o `pages.yml` da `main` terminar verde (mesma ideia do monitor, em `actions/runs?branch=main`). Pushes seguidos cancelam o deploy anterior: confira o último.
4. Confira o ar: `curl -s https://tolisa.com.br/ | grep -o 'app.js?v=[^"]*'` tem que mostrar os 8 primeiros caracteres do SHA da `main`. `?v=__V__` ou a data do `index.html` quer dizer que o Pages voltou a publicar a branch crua (Settings → Pages tem que estar em GitHub Actions).
5. Só então diga que tá no ar, em uma linha.

## Review

Comentário de gente: pedido pequeno, faça e suba; pedido grande, proponha pro usuário. Responda cada thread que você resolveu.
