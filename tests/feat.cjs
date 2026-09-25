const { chromium } = require('./_pw.cjs'); const path = require('path'), os = require('os'); const ROOT = path.join(__dirname, '..'), OUT = os.tmpdir();
const http = require('http'), fs = require('fs');
const seed = fs.readFileSync(path.join(__dirname, 'seed.b64'),'utf8'); const store = {};
const srv = require('./_serve.cjs')(4183);
async function mock(ctx){ await ctx.route('https://fake-db.firebaseio.com/**', route => { const rq = route.request(), m = rq.method(), path = new URL(rq.url()).pathname;
  if (path.startsWith('/pix/')) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  if (m === 'PUT') { store[path] = rq.postData(); return route.fulfill({ status: 200, contentType:'application/json', body: store[path] }); }
  return route.fulfill({ status: 200, contentType: 'application/json', body: store[path] ?? 'null' }); }); }
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c1 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await mock(c1); const p1 = await c1.newPage(); p1.on('pageerror', e => errs.push('p1 '+e.message)); p1.on('dialog', d => d.accept());
  await p1.goto('http://localhost:4183/#seed=' + seed); await p1.fill('#gateCode','bailedamada'); await p1.click('#gateForm button');
  await p1.click('#whoBtn'); await p1.waitForSelector('#whoSel'); await p1.selectOption('#whoSel', { label: 'Júlia' }); await p1.waitForTimeout(300);
  console.log('minha conta:', (await p1.$eval('#mineRows', e => e.innerText)).replace(/\n/g,' | '));
  console.log('status no rodapé:', await p1.evaluate(() => { const st = document.querySelector('#status'); const bars = document.querySelector('.bars'); return bars.compareDocumentPosition(st) & Node.DOCUMENT_POSITION_FOLLOWING ? 'sim' : 'não'; }));
  // Júlia anota a janta em partes diferentes: Lia 18,87 + Mengla 23,97 = 42,84
  await p1.click('#fab'); await p1.waitForSelector('#sheet:not(.hidden)');
  console.log('ordem do form:', await p1.$eval('.two', e => [...e.children].map(c => c.id).join(',')));
  await p1.fill('#amount','42.84'); await p1.fill('#desc','Janta');
  for (const n of ['Fernando','Júlia','Klinsmann']) await p1.click(`#splitChips label:has-text("${n}")`);
  // o modo agora é a palavra "igualmente" da própria frase
  await p1.click('#modeToggle'); await p1.waitForSelector('#sharesBox:not(.hidden)');
  await p1.fill('#sharesBox input[data-share="lia"]','18.87'); await p1.fill('#sharesBox input[data-share="mengla"]','20');
  console.log('hint (sobra/falta):', await p1.$eval('#splitHint', e => e.textContent));
  await p1.click('#expenseForm button.big'); await p1.waitForTimeout(200); console.log('bloqueado:', await p1.$eval('#toast', e => e.textContent));
  await p1.fill('#sharesBox input[data-share="mengla"]','23.97'); await p1.click('#expenseForm button.big'); await p1.waitForSelector('#sheet', { state: 'hidden' });
  console.log('item:', await p1.$eval('#expenses .row', e => e.innerText), '|', await p1.$eval('#expenses .small span', e => e.innerText));
  await p1.click('#expenses [data-among]'); console.log('÷ aberto:', await p1.$eval('#expenses [data-among]', e => e.closest('.small').innerText)); await p1.click('#expenses [data-among]'); console.log('÷ fechado:', await p1.$eval('#expenses [data-among]', e => e.closest('.small').innerText));
  await p1.locator('.paper > .c:visible').last().screenshot({ path: path.join(OUT, 'copylink.png') });
  console.log('dias:', await p1.$$eval('#expenses .day', l => l.map(d => d.textContent)));
  console.log('acerto:', (await p1.$eval('#settle', e => e.innerText)).replace(/\n/g,' | '));
  await p1.screenshot({ path: path.join(OUT, 'feat-1.png'), fullPage: true });
  // Lia abre: vê NOVO no item da Júlia, sua linha marcada, resumo dela
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await mock(c2); const p2 = await c2.newPage(); p2.on('pageerror', e => errs.push('p2 '+e.message));
  await p2.goto('http://localhost:4183/?senha=bailedamada'); await p2.click('#whoBtn'); await p2.waitForSelector('#whoSel'); await p2.selectOption('#whoSel', { label: 'Lia' }); await p2.waitForTimeout(400);
  console.log('novo tags:', await p2.$$eval('#expenses .tag', l => l.length), '| minha linha:', await p2.$eval('#settle .row.mine .l', e => e.innerText));
  console.log('minha conta Lia:', (await p2.$eval('#mineRows', e => e.innerText)).replace(/\n/g,' | '));
  await p2.screenshot({ path: path.join(OUT, 'feat-2.png'), clip: { x: 0, y: 0, width: 390, height: 900 } });
  console.log('errors:', errs); await b.close(); srv.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
