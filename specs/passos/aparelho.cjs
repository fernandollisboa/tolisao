const { Given, When, Then, expect } = require('./_mundo.cjs');

const gaveta = (mundo, k) => mundo.p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);

Given('que este aparelho guardou, do jeito antigo, que eu sou {word} e o segredo {string} da chave dele', async ({ mundo }, quem, tok) => {
  const eu = mundo.pessoa(quem).id;
  mundo.antes = { [`racha:${mundo.sala}:me`]: eu, [`racha:${mundo.sala}:pixtok:${eu}`]: tok, 'racha:visitas': '4', 'racha:chato': '1',
    'racha:room': JSON.stringify({ code: mundo.evento.name, id: mundo.sala }) };
});
When('eu abro o evento', async ({ mundo }) => { await mundo.abre(); await mundo.p.waitForSelector('#app:not(.loading)'); });
Then('o aparelho guarda que eu sou {string} e o segredo {string} da chave do/da {word}', async ({ mundo }, id, tok, quem) => {
  const s = await gaveta(mundo, `tolisa:${mundo.sala}`);
  expect(s.me).toBe(id); expect(s.pixTokens[mundo.pessoa(quem).id]).toBe(tok);
  expect(s.code).toBe(mundo.evento.name);
  const dev = await gaveta(mundo, 'tolisa'); expect(dev).toMatchObject({ visits: 5, boringMode: true }); expect(dev.lastRoom).toBeUndefined();
});
Then('o aparelho não guarda mais nada do jeito antigo', async ({ mundo }) => {
  expect(await mundo.p.evaluate(() => Object.keys(localStorage).filter(k => !k.startsWith('tolisa')))).toEqual([]);
});
Then('o segredo que o banco guarda pro/pra {word} é o que ficou no aparelho', async ({ mundo }, quem) => {
  const id = mundo.pessoa(quem).id;
  await expect.poll(() => mundo.banco.pega(['pix', mundo.sala, id, 'tok'])).toBeTruthy();
  expect((await gaveta(mundo, `tolisa:${mundo.sala}`)).pixTokens[id]).toBe(mundo.banco.pega(['pix', mundo.sala, id, 'tok']));
});

Given('que este aparelho guardou o {string} como o último evento, do jeito de antes da lista', async ({ mundo }, nome) => {
  mundo.antes = { tolisa: JSON.stringify({ visits: 3, lastRoom: { code: nome, id: mundo.sala } }),
    [`tolisa:${mundo.sala}`]: JSON.stringify({ me: 'lia', snapshot: mundo.evento }) };
});
Then('o aparelho não guarda mais o último evento na gaveta dele', async ({ mundo }) => {
  expect((await gaveta(mundo, 'tolisa')).lastRoom).toBeUndefined();
  expect((await gaveta(mundo, `tolisa:${mundo.sala}`)).code).toBe(mundo.evento.name);
});
