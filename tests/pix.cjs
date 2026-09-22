const { chromium } = require('./_pw.cjs'); const path = require('path'), os = require('os'); const ROOT = path.join(__dirname, '..'), OUT = os.tmpdir();
const http = require('http'), fs = require('fs');
const seed = fs.readFileSync(path.join(__dirname, 'seed.b64'),'utf8'); const store = {}; let listagens = 0;
const srv = require('./_serve.cjs')(4182);
// mock com as regras do pix: escrita só se não existe ou tok bate; leitura só de /key
async function mock(ctx){ await ctx.route('https://fake-db.firebaseio.com/**', route => { const rq = route.request(), m = rq.method(), path = new URL(rq.url()).pathname;
  if (path.startsWith('/pix/')) {
    const mm = path.match(/^\/pix\/([^/]+)\/([^/]+)(\/key)?\.json$/); if (!mm) return route.fulfill({ status: 400, body: '{}' });
    const node = `/pix/${mm[1]}/${mm[2]}`;
    if (m === 'PUT') { if (mm[3]) return route.fulfill({ status: 401, body: '{"error":"Permission denied"}' }); const cur = store[node] ? JSON.parse(store[node]) : null; const nw = JSON.parse(rq.postData());
      if (cur && cur.tok !== nw.tok) return route.fulfill({ status: 401, body: '{"error":"Permission denied"}' }); store[node] = rq.postData(); return route.fulfill({ status: 200, body: store[node] }); }
    if (mm[3]) { const cur = store[node] ? JSON.parse(store[node]) : null; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cur ? cur.key : null) }); }
    return route.fulfill({ status: 401, body: '{"error":"Permission denied"}' });
  }
  if (path === '/rooms.json') listagens++;
  if (path === '/rooms.json') { const o = {}; for (const k of Object.keys(store)) { const mm = k.match(/^\/rooms\/([^/]+)\.json$/); if (mm) o[mm[1]] = true; } return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) }); }
  { const mm = path.match(/^\/rooms\/([^/]+)\/name\.json$/); if (mm) { const room = store[`/rooms/${mm[1]}.json`]; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(room ? JSON.parse(room).name ?? null : null) }); } }
  if (m === 'PUT') { store[path] = rq.postData(); return route.fulfill({ status: 200, contentType:'application/json', body: store[path] }); }
  return route.fulfill({ status: 200, contentType: 'application/json', body: store[path] ?? 'null' }); }); }
(async () => {
  const b = await chromium.launch(); const errs = [];
  // Fernando cadastra a chave
  const c1 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await mock(c1); const p1 = await c1.newPage(); p1.on('pageerror', e => errs.push('p1 '+e.message));
  let promptAnswer = '123.456.789-09'; p1.on('dialog', d => d.type() === 'prompt' ? d.accept(promptAnswer) : d.accept());
  await p1.goto('http://localhost:4182/#seed=' + seed); await p1.fill('#gateCode','bailedamada'); await p1.click('#gateForm button');
  await p1.waitForSelector('#whoSel'); await p1.selectOption('#whoSel', { label: 'Fernando' }); await p1.click('#whoForm button'); await p1.waitForTimeout(300);
  const setPix = async (pg, v) => { await pg.click('#pixBtn'); await pg.waitForSelector('#askInput'); await pg.fill('#askInput', v); await pg.click('#askForm button.big'); };
  await setPix(p1, promptAnswer); await p1.waitForTimeout(200); console.log('CPF recusado, toast:', await p1.$eval('#toast', e => e.textContent));
  promptAnswer = '+5583999998888'; await setPix(p1, promptAnswer); await p1.waitForTimeout(200); console.log('telefone recusado, toast:', await p1.$eval('#toast', e => e.textContent));
  promptAnswer = '7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d'; await setPix(p1, promptAnswer); await p1.waitForTimeout(400); console.log('aleatória:', await p1.$eval('#toast', e => e.textContent), '|', await p1.$eval('#whoLine', e => e.innerText));
  // Lia tenta sobrescrever a chave do Fernando (outro aparelho) -> negado
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await mock(c2); const p2 = await c2.newPage(); p2.on('pageerror', e => errs.push('p2 '+e.message));
  await p2.goto('http://localhost:4182/#c=bailedamada'); await p2.waitForSelector('#whoSel'); await p2.selectOption('#whoSel', { label: 'Fernando' }); await p2.click('#whoForm button'); await p2.waitForTimeout(300);
  p2.on('dialog', d => d.type() === 'prompt' ? d.accept('hacker@mal.com') : d.accept());
  await p2.click('#whoBtn'); await p2.waitForSelector('#whoPix'); console.log('campo pré-preenchido no outro aparelho:', await p2.inputValue('#whoPix')); await p2.fill('#whoPix', 'hacker@mal.com'); await p2.click('#whoForm button.big'); await p2.waitForTimeout(400); console.log('troca por outro aparelho:', await p2.$eval('#toast', e => e.textContent));
  console.log('chave no banco continua:', JSON.parse(Object.entries(store).find(([k]) => k.startsWith('/pix/'))[1]).key);
  // Lia (devedora) vê "copiar pix" e copia o código
  await p2.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__copied = t; } } }));
  await p2.click('#whoBtn'); await p2.waitForSelector('#whoSel'); await p2.selectOption('#whoSel', { label: 'Lia' }); await p2.click('#whoForm button'); await p2.waitForTimeout(400);
  console.log('botões na linha da Lia:', await p2.$$eval('#settle .small button', l => l.map(b => b.textContent)));
  await p2.click('[data-pix]'); await p2.waitForTimeout(200); const code = await p2.evaluate(() => window.__copied); console.log('BRCODE:', code);
  console.log('header:', (await p2.$eval('.paper > .c', e => e.innerText)).replace(/\n/g,' | '), '| status visível:', await p2.$eval('#status', e => getComputedStyle(e).display !== 'none'));
  await p2.click('#roomLabel'); await p2.waitForSelector('#evLeave');
  console.log('cartão do evento:', (await p2.$eval('#overlayBox', e => e.innerText)).replace(/\n/g,' | '));
  await p2.click('#evBack'); await p2.waitForTimeout(200);
  await p2.screenshot({ path: path.join(OUT, 'pix-mobile.png'), clip: { x: 0, y: 0, width: 390, height: 640 } });
  await p2.locator('#mineRows .row.sub').first().screenshot({ path: path.join(OUT, 'pixbtn4.png') });
  // quitei -> abre zap com "Paguei"
  await p2.evaluate(() => { window.open = (u) => { window.__wa = u; }; }); await p2.click('[data-settle]'); await p2.waitForSelector('#okBtn'); await p2.click('#okBtn'); await p2.waitForSelector('#waAviso'); await p2.click('#waAviso'); await p2.waitForTimeout(300);
  console.log('zap:', decodeURIComponent((await p2.evaluate(() => window.__wa)).split('text=')[1]));
  console.log('tentativas de listar eventos (deve ser 0):', listagens);
  console.log('errors:', errs); await b.close(); srv.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
