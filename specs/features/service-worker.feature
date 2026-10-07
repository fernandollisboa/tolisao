# language: pt
Funcionalidade: O service worker guarda cópia sem estragar a resposta
  Rede primeiro, cache de reserva, com prazo pra rede. A cópia pro cache tem que sair antes de o
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

  Cenário: com sinal ruim, a cópia guardada abre sem esperar a rede
    Num 3G engasgado a rede leva dezenas de segundos pra responder ou desistir:
    quem já abriu o app antes não fica olhando tela branca.
    Dado que o service worker já tem cópia de um arquivo
    Quando ele busca esse arquivo e a rede demora a responder
    Então o arquivo abre com a cópia guardada
    Quando a rede enfim responde
    Então o cache fica com a versão da rede

  Cenário: sem cópia guardada, a rede lenta ainda abre o arquivo
    Quando o service worker busca um arquivo sem cópia e a rede demora a responder
    Então o arquivo abre com o que veio da rede
