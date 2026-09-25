const { chromium } = require('./_pw.cjs'); const path = require('path'), os = require('os'); const ROOT = path.join(__dirname, '..'), OUT = os.tmpdir();
const http = require('http'), fs = require('fs');
const seed = fs.readFileSync(path.join(__dirname, 'seed.b64'),'utf8');
const srv = require('./_serve.cjs')(4179);
const store = {};
async function mock(ctx){ await ctx.route('https://fake-db.firebaseio.com/**', route => { const rq = route.request(), m = rq.method(), path = new URL(rq.url()).pathname;
  if (m === 'PUT') { store[path] = rq.postData(); return route.fulfill({ status: 200, contentType:'application/json', body: store[path] }); }
  return route.fulfill({ status: 200, contentType: 'application/json', body: store[path] ?? 'null' }); }); }
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c1 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await mock(c1); const p1 = await c1.newPage(); p1.on('pageerror', e => errs.push('p1 '+e.message));
  const dialogs = []; p1.on('dialog', d => { dialogs.push(d.message()); d.type() === 'prompt' ? d.accept('Zé') : d.accept(); });
  await p1.goto('http://localhost:4179/#seed=' + seed);
  await p1.fill('#gateCode','bailedamada'); await p1.click('#gateForm button'); await p1.click('#whoBtn'); await p1.waitForSelector('#whoSel');
  await p1.selectOption('#whoSel', { label: 'Lia' }); await p1.evaluate(() => document.fonts.ready); await p1.waitForTimeout(400);
  if (!await p1.$eval('#fab', e => e.classList.contains('chamando'))) throw new Error('fab deveria começar chamando');
  await p1.screenshot({ path: path.join(OUT, 'app-mobile.png'), fullPage: true });
  console.log('botões quitar em Minha conta (Lia):', await p1.$$eval('#mineRows [data-settle]', l => l.length), '| settle rows:', await p1.$$eval('#settle .row:not(.paid)', l => l.length), '| expenses shown:', await p1.$$eval('#expenses .row', l => l.length), '| toggle:', await p1.$eval('#toggleAll', e => e.textContent));
  // Quitei na primeira linha
  await p1.click('#mineRows [data-settle]'); await p1.waitForSelector('#okBtn'); await p1.screenshot({ path: path.join(OUT, 'card-quitei.png') }); await p1.click('#okBtn'); await p1.waitForSelector('#quitOk'); await p1.click('#quitOk'); await p1.waitForTimeout(200);
  console.log('after quitei rows:', await p1.$$eval('#settle .row:not(.paid)', l => l.length), '| top expense:', await p1.$eval('#expenses .row', e => e.innerText.split('\n')[0]));
  console.log('scrollWidth/innerWidth:', await p1.evaluate(() => document.documentElement.scrollWidth + '/' + innerWidth));
  // ver todos
  console.log('toggle hidden (<=10 itens):', await p1.$eval('#toggleAll', e => e.classList.contains('hidden')));
  // adicionar pessoa via prompt
  // a lista do rodapé está atrás da constante MEMBROS; revelamos pra exercitar o +
  await p1.evaluate(() => document.getElementById('peopleSec').classList.remove('hidden'));
  await p1.click('#addPerson'); await p1.waitForSelector('#askInput'); await p1.fill('#askInput','Zé'); await p1.click('#askForm button.big'); await p1.waitForTimeout(200); console.log('people:', await p1.$eval('#peopleLine', e => e.innerText));
  // FAB + gasto
  await p1.click('#fab'); await p1.waitForSelector('#sheet:not(.hidden)'); await p1.fill('#desc','Cerveja'); await p1.fill('#amount','50'); await p1.click('#expenseForm button');
  await p1.waitForSelector('#sheet', { state: 'hidden' }); console.log('added via fab; top expense:', await p1.$eval('#expenses .row', e => e.innerText.split('\n')[0]));
  if (!await p1.$eval('#fab', e => e.classList.contains('chamando'))) throw new Error('fab deveria continuar chamando depois do primeiro gasto');
  await p1.screenshot({ path: path.join(OUT, 'app-mobile-2.png'), fullPage: true });
  // segundo aparelho vê tudo
  const c2 = await b.newContext(); await mock(c2); const p2 = await c2.newPage(); p2.on('pageerror', e => errs.push('p2 '+e.message));
  await p2.goto('http://localhost:4179/?senha=bailedamada'); await p2.click('#whoBtn'); await p2.waitForSelector('#whoSel'); await p2.selectOption('#whoSel', { label: 'Lia' }); await p2.waitForTimeout(300);
  console.log('p2 sees Cerveja:', (await p2.$eval('#expenses', e => e.innerText)).toUpperCase().includes('CERVEJA'), '| p2 settle rows:', await p2.$$eval('#settle .row:not(.paid)', l => l.length));
  console.log('dialogs:', dialogs.length, '| errors:', errs); await b.close(); srv.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
