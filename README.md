# Racha

Divisor de gastos estilo Splitwise, mínimo. Um único HTML, sem backend pra manter, sem conta, sem app.

**Site:** https://fernandollisboa.github.io/splitwise-lite/

## Como funciona

1. Abra o site e digite o **código do grupo** (ex.: o combinado no zap). Pronto, você está dentro.
2. Escolha seu nome em "Quem é você?".
3. Lance gastos: dividido igualmente (deixe o pagador marcado) ou empréstimo (desmarque o pagador e deixe só quem deve).
4. **Acerto de contas** mostra o mínimo de pix pra zerar todo mundo.

Pra convidar alguém: manda o link do site e o código. Um código que ainda não existe cria um grupo novo (a página pergunta antes).

## Onde ficam os dados

Num **Firebase Realtime Database** (plano gratuito), acessado direto do navegador pela API REST.
Cada grupo fica em `rooms/<sha256(código)>`. A URL do banco está na constante `DB` do `index.html`.
Os clientes mesclam por id e atualizam a cada 6s, então edições simultâneas de celulares diferentes não se sobrescrevem.

Regras do banco (Realtime Database → Regras):

```json
{
  "rules": {
    "rooms": { ".read": true, "$room": { ".write": true } },
    "pix": {
      "$room": {
        "$person": {
          ".write": "!data.exists() || data.child('tok').val() === newData.child('tok').val()",
          ".validate": "newData.hasChildren(['key','tok']) && newData.child('key').isString() && newData.child('key').val().length <= 80 && newData.child('tok').isString()",
          "key": { ".read": true }
        }
      }
    }
  }
}
```

Quem tem o código lê e escreve no grupo. A leitura em `rooms` permite listar os eventos (o nome de cada sala fica em `rooms/<sala>/name`). Não guarde nada sensível.

### Chave Pix

Cada pessoa pode cadastrar uma chave Pix (só chave aleatória ou e-mail; CPF e telefone são recusados).
A chave fica em `pix/<sala>/<pessoa>/key` (legível por todos) junto de um segredo `tok` gerado pelo navegador de quem cadastrou
e guardado só nesse aparelho. A regra acima só aceita alterar a chave se o `tok` enviado bater com o gravado, e ninguém consegue ler o `tok`.
Resultado: todo mundo vê a chave, só o aparelho que cadastrou consegue trocar. Se a pessoa perder o aparelho, apague o nó dela no console do Firebase.

Quem deve vê um botão **copiar pix** na sua linha do acerto: copia um "Pix copia e cola" (BR Code) já com o valor, pra colar no app do banco.

## Deploy

GitHub Pages publica a branch `main` via `.github/workflows/pages.yml`.
