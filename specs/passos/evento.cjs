const { Given, When, Then, expect, idDe, AGORA } = require('./_mundo.cjs');

const festa = require('../_festa.cjs');

const centavos = v => Math.round(Number(v.replace(/\./g, '').replace(',', '.')) * 100);

const poeGente = (mundo, nome, gente) =>
  mundo.criaEvento({ name: nome, people: gente.map((n, i) => ({ id: idDe(n), name: n, at: i + 1 })), expenses: [], deleted: [] });

const poeGastos = (mundo, linhas) => {
  const id = n => mundo.pessoa(n).id;
  linhas.forEach((g, i) => {
    const e = { id: 'g' + (mundo.evento.expenses.length + 1), desc: g['o quê'], amount: centavos(g.valor) / 100,
      payer: id(g.pagou), among: g['divide entre'].split(/\s*,\s*/).map(id), at: AGORA - 7 * 86400000 + i * 60000 };
    mundo.evento.expenses.push(e);
  });
};

Given('o evento {string} com {gente}', async ({ mundo }, nome, gente) => { poeGente(mundo, nome, gente); });

// turma grande: o dobro das 10 cores fixas (PALETTE), pra passar com folga do ponto em que
// a cor começa a ser gerada. Os nomes e o número não importam pro cenário, só que é muita gente
const TURMA = 'Ana Bia Caio Duda Edu Fê Gil Hugo Iara Jão Kika Léo Mel Nina Otto Pri Quel Rui Sol Téo'.split(' ');
Given('um evento com uma turma grande', async ({ mundo }) => { poeGente(mundo, 'turma', TURMA); });

Given('os gastos:', async ({ mundo }, tabela) => { poeGastos(mundo, tabela.hashes()); });

// a mesma festa que o acerto e o anotar usam, de specs/_festa.cjs
Given('o evento de exemplo {string}', async ({ mundo }, nome) => {
  const f = festa[nome];
  if (!f) throw new Error(`não tem festa de exemplo "${nome}" em specs/_festa.cjs`);
  poeGente(mundo, nome, f.gente);
  poeGastos(mundo, f.gastos);
});

Given('(que )o/a {word} tem a chave pix {string}', async ({ mundo }, quem, chave) => { mundo.banco.pix(mundo.sala, mundo.pessoa(quem).id, chave); });
Given('(que )o/a {word} já cadastrou a chave pix {string} em outro aparelho', async ({ mundo }, quem, chave) => { mundo.banco.pix(mundo.sala, mundo.pessoa(quem).id, chave); });

Given('que eu abro o site sem evento', async ({ mundo }) => { await mundo.abre({ semEvento: true }); });
When('eu abro o evento como {word}', async ({ mundo }, quem) => { await mundo.abre({ quem }); });
When('eu abro o evento como {word} num celular', async ({ mundo }, quem) => { await mundo.abre({ quem, toque: true }); });
When('eu troco pra {word}', async ({ mundo }, quem) => { await mundo.souEu(quem); });
When('eu abro o evento como {word} em outro aparelho', async ({ mundo }, quem) => { await mundo.abre({ quem }); });
When('eu recarrego a página', async ({ mundo }) => { await mundo.p.reload(); await mundo.p.waitForSelector('#app:not(.loading)'); });

When('eu digito o código {string}', async ({ mundo }, codigo) => { await mundo.p.fill('#gateCode', codigo); await mundo.p.click('#gateForm button'); });
Then('o site pergunta se é um evento novo', async ({ mundo }) => { await expect(mundo.p.locator('#okBtn')).toBeVisible(); });
When('eu volto', async ({ mundo }) => { await mundo.p.click('#cancelBtn'); });
Then('o cartão do código volta com {string} escrito', async ({ mundo }, codigo) => { await expect(mundo.p.locator('#gateCode')).toHaveValue(codigo); });
Then('aparece o recado {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#gateErr')).toHaveText(txt); });
When('eu toco fora do cartão', async ({ mundo }) => { await mundo.p.mouse.click(5, 5); await mundo.p.waitForTimeout(200); });
When('eu crio o evento', async ({ mundo }) => { await mundo.p.click('#okBtn'); await mundo.p.waitForSelector('#app:not(.loading)'); });
Then('o endereço termina em {string}', async ({ mundo }, fim) => { await expect.poll(() => mundo.p.evaluate(() => location.search)).toBe(fim); });
Then('o endereço é {string} com um final sorteado', async ({ mundo }, ini) => {
  const esc = ini.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect.poll(() => mundo.p.evaluate(() => location.search)).toMatch(new RegExp(`^${esc}[a-z0-9]{6}$`));
});
Then('o nome do evento no cabeçalho é {string}', async ({ mundo }, nome) => { await expect(mundo.p.locator('#roomLabel')).toHaveText(nome); });
Then('o site não pergunta nada', async ({ mundo }) => { await expect(mundo.p.locator('#okBtn')).toBeHidden(); });
When('eu colo o link {string} na mesma aba', async ({ mundo }, q) => { await mundo.p.evaluate(q => { location.search = q; }, q); });

When('eu toco no nome do evento', async ({ mundo }) => { await mundo.p.click('#roomLabel'); await mundo.p.waitForSelector('#evBack'); });
Then('o cartão mostra:', async ({ mundo }, txt) => {
  // o R$ vem colado no valor por um espaço que não quebra; no .feature ele é um espaço comum
  await expect.poll(async () => (await mundo.linhas('#overlayBox')).map(l => l.replace(/\u00a0/g, ' '))).toEqual(txt.split('\n').map(l => l.trim()).filter(Boolean));
});
When('eu toco em voltar', async ({ mundo }) => { await mundo.p.click('#evBack'); });
When('eu toco no código do evento', async ({ mundo }) => { await mundo.p.click('#evCode'); });
Then('fica copiado {string}', async ({ mundo }, txt) => { await expect.poll(() => mundo.p.evaluate(() => window.__copiado)).toBe(txt); });
Then('o cartão fecha', async ({ mundo }) => { await expect(mundo.p.locator('#overlay')).toHaveClass(/\bhidden\b/); });
When('eu toco na caixa do caderno em branco', async ({ mundo }) => { await mundo.p.click('#settle .empty.anota'); });
Then('o formulário de anotar abre', async ({ mundo }) => { await expect(mundo.p.locator('#sheet')).not.toHaveClass(/\bhidden\b/); });
When('eu toco no meu nome', async ({ mundo }) => { await mundo.p.click('#whoBtn'); await mundo.p.waitForSelector('#whoSel'); });
Then('o cartão de quem é você já vem com {word} escolhida/escolhido', async ({ mundo }, quem) => {
  await expect(mundo.p.locator('#whoSel option:checked')).toHaveText(quem);
  await expect(mundo.p.locator('#whoSel')).not.toBeFocused();
});
Then('o cartão de quem é você não tem botão de sair', async ({ mundo }) => { await expect(mundo.p.locator('#leaveBtn')).toHaveCount(0); });

Then('aparece o aviso {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#toast')).toHaveText(txt); });

// evento sem ninguém: o "quem é você?" vira a lista de gente
// a sala aberta é a gaveta que guarda o código que está no endereço
const salaAberta = mundo => mundo.p.evaluate(() => { const c = new URLSearchParams(location.search).get('evento');
  return Object.keys(localStorage).find(k => k.startsWith('tolisa:') && JSON.parse(localStorage.getItem(k) || '{}').code === c)?.slice(7); });
When('eu toco em quem é você', async ({ mundo }) => { await mundo.p.click('#whoBtn'); await mundo.p.waitForSelector('#overlayBox h2'); });
When('eu ponho {gente} na lista', async ({ mundo }, gente) => {
  for (const n of gente) { await mundo.p.fill('#setupName', n); await mundo.p.press('#setupName', 'Enter'); await expect(mundo.p.locator('#setupName')).toHaveValue(''); }
});
When('eu tento pôr {word} na lista de novo', async ({ mundo }, n) => { await mundo.p.fill('#setupName', n); await mundo.p.press('#setupName', 'Enter'); });
When('eu tiro o/a {word} da lista', async ({ mundo }, nome) => {
  await mundo.p.locator('#overlayBox .row', { hasText: nome }).locator('[data-drop]').click();
  await expect(mundo.p.locator('#overlayBox .row', { hasText: nome })).toHaveCount(0);
});
When('eu escrevo {word} e aperto pronto sem dar enter', async ({ mundo }, n) => { await mundo.p.fill('#setupName', n); await mundo.p.click('#setupGo'); });
When('eu troco o nome da/do {word} pra {word} na lista', async ({ mundo }, de, pra) => {
  const el = mundo.p.locator('#overlayBox [data-renome]', { hasText: de }); await el.click();
  await mundo.p.keyboard.press('ControlOrMeta+A'); await mundo.p.keyboard.type(pra); await mundo.p.keyboard.press('Enter');
});
When('eu escolho outra pessoa', async ({ mundo }) => { await mundo.p.selectOption('#whoSel', '__new'); await mundo.p.waitForSelector('#setupName'); });
Then('só a/o {word} tem ✕ na lista', async ({ mundo }, nome) => {
  await expect(mundo.p.locator('#overlayBox .row.pessoa:has([data-drop])')).toHaveCount(1);
  await expect(mundo.p.locator('#overlayBox .row.pessoa:has([data-drop])')).toContainText(nome);
});
Then('ninguém tem a mesma cor', async ({ mundo }) => {
  const cores = await mundo.p.$$eval('#overlayBox .row.pessoa .bola', bs => bs.map(b => getComputedStyle(b).backgroundColor));
  expect(cores).toHaveLength(TURMA.length); expect(new Set(cores).size).toBe(TURMA.length);
});
// o Quem vai? de quem já está no evento: entra como a primeira da turma (quem é não muda nada aqui)
When('eu abro o Quem vai?', async ({ mundo }) => {
  await mundo.abre({ quem: mundo.evento.people[0].name });
  await mundo.p.click('#whoBtn'); await mundo.p.click('#whoMais'); await mundo.p.waitForSelector('#setupName');
});
When('eu continuo', async ({ mundo }) => { await mundo.p.click('#setupGo'); });
Then('o site pergunta quem é você', async ({ mundo }) => { await expect(mundo.p.locator('#whoSel')).toBeVisible(); });
When('eu escolho {word}', async ({ mundo }, quem) => { await mundo.p.selectOption('#whoSel', { label: quem }); });
Then('o evento no banco tem {gente}', async ({ mundo }, gente) => {
  const sala = await salaAberta(mundo);
  await expect.poll(() => (mundo.banco.pega(['rooms', sala, 'people']) || []).map(p => p.name)).toEqual(gente);
});

// o evento some do banco com o aparelho ainda guardando a cópia
When('o evento some do banco', async ({ mundo }) => {
  await mundo.p.waitForSelector('#app:not(.loading)');
  await expect.poll(() => mundo.p.evaluate(k => !!JSON.parse(localStorage.getItem(k) || '{}').snapshot, `tolisa:${mundo.sala}`)).toBe(true);
  delete mundo.banco.arvore.rooms[mundo.sala];
});
When('eu abro o site de novo', async ({ mundo }) => { await mundo.p.reload(); await mundo.p.waitForSelector('#overlayBox h2'); });
When('eu restauro da minha cópia', async ({ mundo }) => {
  await Promise.all([mundo.p.waitForEvent('load'), mundo.p.click('#restoreBtn')]);
  await mundo.p.waitForSelector('#app:not(.loading)');
});
Then('o evento volta pro banco com o/a {word}', async ({ mundo }, desc) => {
  expect((mundo.banco.pega(['rooms', mundo.sala, 'expenses']) || []).map(e => e.desc)).toEqual([desc]);
});
When('eu desisto do evento', async ({ mundo }) => { await Promise.all([mundo.p.waitForEvent('load'), mundo.p.click('#lostBack')]); });
Then('aparece o cartão do código', async ({ mundo }) => { await expect(mundo.p.locator('#gateCode')).toBeVisible(); });
Then('o aparelho esquece o evento', async ({ mundo }) => {
  expect(await mundo.p.evaluate(() => location.search)).toBe('');
  await expect(mundo.p.locator('#overlayBox .ev')).toHaveCount(0);
  const g = await mundo.p.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), `tolisa:${mundo.sala}`);
  expect(g.hidden).toBe(true); expect(g.snapshot).toBeTruthy();
});

// o link pode dizer quem vai abrir (&quem=); ?senha= é o nome antigo do parâmetro
// o link do zap é a última coisa da mensagem
const linkDoZap = mundo => mundo.p.evaluate(() => decodeURIComponent(window.__aberto.split('text=')[1]).trim().split(/\s+/).pop());
Then('o link do zap entra como {word}', async ({ mundo }, quem) => {
  // a pasta c/h, c/i ou c/j só escolhe a figurinha do preview
  await expect.poll(() => linkDoZap(mundo)).toMatch(new RegExp(`^${mundo.base}/c/[hij]/\\?evento=${mundo.evento.name}&quem=${mundo.pessoa(quem).id}$`));
});
When('eu abro o link do zap em outro aparelho', async ({ mundo }) => {
  const link = await linkDoZap(mundo); await mundo.abre({ link }); await mundo.p.waitForSelector('#app:not(.loading)');
});
When('eu colo o link do evento pra {word} na mesma aba', async ({ mundo }, quem) => {
  await mundo.p.evaluate(q => { location.search = q; }, `?evento=${mundo.evento.name}&quem=${mundo.pessoa(quem).id}`);
  await mundo.p.waitForSelector('#app:not(.loading)');
});
When('eu abro o endereço {string}', async ({ mundo }, q) => { await mundo.abre({ link: mundo.base + '/' + q }); await mundo.p.waitForSelector('#app:not(.loading)'); });
