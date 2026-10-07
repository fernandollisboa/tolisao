const { Given, When, Then, expect, AGORA } = require('./_mundo.cjs');

// o que o aparelho já guardava de outros eventos, antes desta visita (as gavetas se somam)
const naGaveta = (mundo, k, o) => { const a = (mundo.antes ||= {}); a[k] = JSON.stringify({ ...JSON.parse(a[k] || '{}'), ...o }); };
Given('que neste aparelho eu sou {word} no {string}', async ({ mundo }, quem, nome) => {
  const rooms = mundo.banco.arvore.rooms, sala = Object.keys(rooms).find(id => rooms[id].name === nome), ev = rooms[sala];
  naGaveta(mundo, `tolisa:${sala}`, { code: nome, openedAt: AGORA - 86400000, me: ev.people.find(p => p.name === quem).id,
    snapshot: JSON.parse(JSON.stringify({ v: 2, updatedAt: AGORA - 86400000, gone: [], ...ev })) });
});
// a última visita deste aparelho ao evento: o que mudou depois dela ganha marca na lista
Given('que eu vi o evento pela última vez ontem', async ({ mundo }) => { naGaveta(mundo, `tolisa:${mundo.sala}`, { lastSeen: AGORA - 86400000 }); });
Given('que eu já usei a chave pix {string} em outro evento', async ({ mundo }, chave) => { naGaveta(mundo, 'tolisa', { pixKey: chave }); });
Given('que da última vez, em outro evento, eu fui {string}', async ({ mundo }, nome) => { naGaveta(mundo, 'tolisa', { myName: nome }); });

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

// apagar meus dados: a chave pix que este aparelho cadastrou (o tok fica na gaveta), o evento esquecido pelo ✕
const salaDe = (mundo, nome) => { const rooms = mundo.banco.arvore.rooms; return Object.keys(rooms).find(id => rooms[id].name === nome); };
const idNo = (mundo, sala, quem) => mundo.banco.arvore.rooms[sala].people.find(p => p.name === quem).id;
Given('que neste aparelho eu cadastrei a chave pix {string} da/do {word} no {string}', async ({ mundo }, chave, quem, nome) => {
  const sala = salaDe(mundo, nome), id = idNo(mundo, sala, quem);
  ((mundo.banco.arvore.pix ||= {})[sala] ||= {})[id] = { key: chave, tok: 'tok-deste-aparelho' };
  naGaveta(mundo, `tolisa:${sala}`, { pixTokens: { [id]: 'tok-deste-aparelho' } });
  naGaveta(mundo, 'tolisa', { pixKey: chave, myName: quem });
});
Given('que eu esqueci o {string} neste aparelho', async ({ mundo }, nome) => { naGaveta(mundo, `tolisa:${salaDe(mundo, nome)}`, { hidden: true }); });
When('eu toco em apagar meus dados deste aparelho', async ({ mundo }) => { await mundo.p.click('#apagaTudo'); await mundo.p.waitForSelector('#okBtn'); });
Then('a tela é a de quem nunca entrou', async ({ mundo }) => {
  await expect(mundo.p.locator('#overlayBox')).toContainText('racha a conta do rolê');
  await expect(mundo.p.locator('#overlayBox .ev')).toHaveCount(0);
  await expect(mundo.p.locator('#apagaTudo')).toHaveCount(0);
});
Then('o {string} no banco não tem mais a chave pix da/do {word}', async ({ mundo }, nome, quem) => {
  const sala = salaDe(mundo, nome);
  expect(mundo.banco.pega(['pix', sala, idNo(mundo, sala, quem), 'key'])).toBe('');
});
