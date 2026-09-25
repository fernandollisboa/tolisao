// dados hostis vindos do banco não podem virar HTML: ids fora de [a-z0-9] são descartados, textos escapados
const { chromium } = require('./_pw.cjs'); const path = require('path'), http = require('http'), fs = require('fs');
const srv = require('./_serve.cjs')(4187);
const evil = { name: 'bailedamada', updatedAt: 1, people: [
    { id: 'fernando', name: 'Fernando', at: 1 }, { id: 'lia', name: '<img src=x onerror="window.__xss=1">Lia', at: 2 },
    { id: 'x" onmouseover="window.__xss=2" data-y="', name: 'Hacker', at: 3 } ],
  expenses: [ { id: 'a', desc: '<script>window.__xss=3</script>Cerveja', amount: 90, payer: 'fernando', among: ['fernando', 'lia'], at: 3, by: '<b>x</b>' },
    { id: 'b"><img src=x onerror="window.__xss=4">', desc: 'Ruim', amount: 10, payer: 'fernando', among: ['lia'], at: 4 },
    { id: 'c', desc: 'Sem payer válido', amount: 10, payer: 'x" onmouseover="window.__xss=2" data-y="', among: ['lia'], at: 5 } ], deleted: [] };
(async () => { const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const errs = [];
  await c.route(/fake-db/, r => { const u = r.request().url(); if (u.includes('/pix/')) return r.fulfill({ json: u.includes('/lia/') ? '<img src=x onerror="window.__xss=5">' : null }); if (r.request().method() !== 'GET') return r.fulfill({ json: {} }); r.fulfill({ json: evil }); });
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:4187/?senha=bailedamada'); await p.click('#whoBtn'); await p.waitForSelector('#whoSel'); await p.selectOption('#whoSel', { label: 'Fernando' }); await p.waitForTimeout(800);
  await p.click('#itemsHead'); await p.waitForTimeout(100);
  await p.evaluate(() => document.getElementById('peopleSec').classList.remove('hidden'));
  const r = await p.evaluate(() => ({ xss: window.__xss, people: [...document.querySelectorAll('#peopleLine .nm')].map(e => e.textContent), items: [...document.querySelectorAll('#expenses .item .l')].map(e => e.textContent.trim()), pixBtns: document.querySelectorAll('[data-pix]').length, imgs: document.querySelectorAll('img:not(.stain)').length }));
  console.log(JSON.stringify(r), '| errors:', errs);
  const ok = r.xss === undefined && r.people.length === 2 && r.items.length === 1 && r.items[0].includes('<script>') && r.pixBtns === 0 && r.imgs === 0 && !errs.length;
  console.log(ok ? 'xss: ok' : 'xss: FALHOU'); await b.close(); srv.close(); process.exit(ok ? 0 : 1); })();
