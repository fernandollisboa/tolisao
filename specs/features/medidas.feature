# language: pt
Funcionalidade: Medir quem entra como quem
  Antes de travar o nome no aparelho (#262), o tô lisa mede se dois celulares viram a mesma
  pessoa e se um celular troca de nome. Nada identifica ninguém: o aparelho é um sorteio só
  daquele evento, e a medição não leva a sala nem a pessoa.

  Contexto:
    Dado o evento "churras" com Fernando, Júlia e Lia

  Cenário: dois celulares que viram a mesma pessoa ficam registrados
    Quando eu abro o evento como Lia
    E eu abro o evento como Lia em outro aparelho
    Então o banco registra 2 aparelhos como Lia

  Cenário: o celular que troca de nome fica registrado nas duas pessoas, e a troca é medida
    Quando eu abro o evento como Lia
    E eu troco pra Júlia
    Então o banco registra o mesmo aparelho como Lia e como Júlia
    E a medição recebe uma primeira escolha e uma troca

  Cenário: o aparelho do dono fica fora das medições
    Dado que este aparelho não entra nas medições
    Quando eu abro o evento como Lia
    E eu troco pra Júlia
    Então nem o banco nem a medição recebem nada
