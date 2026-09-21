const { chromium } = require('./_pw.cjs'); const path = require('path'), os = require('os'); const ROOT = path.join(__dirname, '..'), OUT = os.tmpdir();
const http = require('http'), fs = require('fs');
const seed = fs.readFileSync(path.join(__dirname, 'seed.b64'),'utf8'); const store = {};
const srv = require('./_serve.cjs')(4181);
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx.route('https://fake-db.firebaseio.com/**', route => { const rq = route.request(), m = rq.method(), path = new URL(rq.url()).pathname;
    if (m === 'PUT') { store[path] = rq.postData(); return route.fulfill({ status: 200, contentType:'application/json', body: store[path] }); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: store[path] ?? (path.includes('/pix/') && path.includes('/fernando/') ? '"fernando@exemplo.com"' : 'null') }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:4181/#seed=' + seed); await p.fill('#gateCode','bailedamada'); await p.click('#gateForm button');
  await p.waitForSelector('#whoSel'); await p.selectOption('#whoSel', { label: 'Lia' }); await p.click('#whoForm button'); await p.waitForTimeout(300);
  await p.click('#settle [data-settle]'); await p.waitForSelector('#okBtn'); await p.click('#okBtn'); await p.waitForTimeout(200);   // uma quitação pra sair o carimbo
  await p.evaluate(() => { window.open = (u) => { window.__wa = u; }; });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#waBtn')]);
  await dl.saveAs(path.join(OUT, 'receipt.png')); console.log('texto:', decodeURIComponent((await p.evaluate(() => window.__wa)).split('text=')[1])); console.log('download:', dl.suggestedFilename(), '| wa opened:', !!(await p.evaluate(() => window.__wa)), '| errors:', errs);
  await b.close(); srv.close(); })().catch(e => { console.error('FAIL', e); process.exit(1); });
