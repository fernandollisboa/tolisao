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

  Cenário: versão nova do arquivo substitui a velha no cache
    Cada deploy muda a versão do app.js e do style.css: guardar todas enchia o celular
    de quem usa muito, uma cópia por deploy, pra sempre.
    Quando o service worker guarda a versão nova de um arquivo que já tinha cópia
    Então o cache só tem a versão nova desse arquivo
    E os outros arquivos continuam no cache
    E sem rede, o arquivo abre com a versão nova

  Cenário: rede lenta não segura a abertura de quem já tem cópia
    No 3G engasgado do bar a rede pode levar dezenas de segundos pra desistir. Com uma
    cópia guardada, o app abre com ela, e a versão nova fica pra próxima vez.
    Quando o service worker busca um arquivo que já tem cópia e a rede passa do prazo
    Então ele abre com a cópia guardada
    E a resposta da rede, quando chega, vai pro cache

  Cenário: rede lenta sem cópia guardada espera a rede
    Quando o service worker busca um arquivo sem cópia e a rede passa do prazo
    Então ele abre com a resposta da rede
