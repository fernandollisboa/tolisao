# language: pt
Funcionalidade: O service worker guarda cópia sem estragar a resposta
  Rede primeiro, cache de reserva. A cópia pro cache tem que sair antes de o
  navegador começar a ler a resposta, senão "Response body is already used".

  Cenário: página e arquivo guardam cópia antes da leitura
    Quando o service worker busca um arquivo e o cache demora pra abrir
    Então ele copia a resposta antes de o navegador ler
    E guarda a cópia no cache
    Quando o service worker busca a página e o cache demora pra abrir
    Então ele copia a resposta antes de o navegador ler
    E guarda a cópia no cache

  Cenário: resposta com erro não vai pro cache
    Quando o service worker busca um arquivo que responde com erro
    Então ele não copia nem guarda nada
