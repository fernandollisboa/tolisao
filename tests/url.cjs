// o código do evento no endereço, e o "voltar" do "Evento novo?" quando o código sai errado
const { chromium } = require('./_pw.cjs'); const store = {};
const srv = require('./_serve.cjs')(4187);
const falha = m => { console.error('FAIL', m); process.exit(1); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://fake-db.firebaseio.com/**', r => { const rq = r.request(), path = new URL(rq.url()).pathname;
    if (rq.method() === 'PUT') { store[path] = rq.postData(); return r.fulfill({ status: 200, contentType: 'application/json', body: store[path] }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: store[path] ?? 'null' }); });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:4187/');
  // código errado: o "Evento novo?" tem voltar, e voltar devolve o cartão do código preenchido
  await p.fill('#gateCode', 'bailedamda'); await p.click('#gateForm button');
  await p.waitForSelector('#okBtn'); if (!(await p.$('#cancelBtn'))) falha('"Evento novo?" sem voltar');
  await p.click('#cancelBtn'); await p.waitForSelector('#gateForm');
  if (await p.inputValue('#gateCode') !== 'bailedamda') falha('o código digitado se perdeu');
  console.log('voltar:', await p.$eval('#gateErr', e => e.textContent));
  // tocar fora do cartão também volta pro código, em vez de deixar a tela vazia
  await p.click('#gateForm button'); await p.waitForSelector('#okBtn');
  await p.mouse.click(5, 5); await p.waitForSelector('#gateForm', { timeout: 3000 }).catch(() => falha('tocar fora deixou a tela sem cartão'));
  console.log('tocar fora: volta pro código');
  // agora cria: o endereço passa a levar o código
  await p.fill('#gateCode', 'Bailedamada'); await p.click('#gateForm button'); await p.click('#okBtn');
  await p.waitForSelector('#app:not(.loading)'); const h = await p.evaluate(() => location.hash);
  if (h !== '#c=bailedamada') falha('endereço sem o código: ' + h); console.log('endereço:', h);
  // recarregar com o código no endereço fica no mesmo evento, sem perguntar nada
  await p.reload(); await p.waitForSelector('#app:not(.loading)');
  if (await p.isVisible('#okBtn')) falha('recarregar perguntou de novo');
  // colar o link de outro evento na mesma aba entra nele
  await p.evaluate(() => { location.hash = '#c=outroevento'; }); await p.waitForSelector('#okBtn', { timeout: 5000 }).catch(() => falha('colar outro link não trocou de evento'));
  console.log('outro link na mesma aba: pergunta se cria "outroevento"');
  if (errs.length) falha(errs.join(' | '));
  console.log('url: ok'); await b.close(); srv.close();
})().catch(e => falha(e.message));
