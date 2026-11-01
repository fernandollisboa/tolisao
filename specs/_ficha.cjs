const centro = async p => { const b = await p.locator('.stain').boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const tem = (p, classe) => p.evaluate(c => document.querySelector('.stain').classList.contains(c), classe);
const pousa = async (p, timeout = 12000) => { await p.waitForSelector('.stain.pousou', { timeout }); await p.waitForTimeout(500); };
// o dedo de verdade: um ponto por quadro, com o relógio andando (o embalo da largada sai da velocidade dele)
let dedo = { x: 0, y: 0 };
const passa = async (p, ate, ms) => {
  const de = dedo, n = Math.max(1, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) { await p.mouse.move(de.x + (ate.x - de.x) * i / n, de.y + (ate.y - de.y) * i / n); await p.waitForTimeout(16); }
  dedo = ate;
};
// pega a ficha no primeiro toque, no centro ou deslocado dele (pela borda ela gira até vir a reboque)
const agarra = async (p, dx = 0, dy = 0) => {
  const o = await centro(p); dedo = { x: o.x + dx, y: o.y + dy };
  await p.mouse.move(dedo.x, dedo.y, { steps: 8 }); await p.waitForTimeout(300); await p.mouse.down(); await p.waitForTimeout(250);
};
const arrasta = async (p, x, y) => { await passa(p, { x: 200, y: 380 }, 600); await passa(p, { x, y }, 500); await p.waitForTimeout(250); };
const solta = async p => { await p.mouse.up(); await p.waitForTimeout(500); };
const rolaPraCima = async p => {
  const antes = await p.evaluate(() => scrollY), o = await centro(p);
  await p.mouse.wheel(0, -500); await p.waitForTimeout(900);
  return { rolou: antes - await p.evaluate(() => scrollY), andou: (await centro(p)).y - o.y };
};
const joga = async p => {
  await agarra(p); const o = await centro(p);
  await passa(p, { x: o.x + 30, y: o.y + 8 }, 120); await passa(p, { x: o.x + 260, y: o.y - 160 }, 90); await p.mouse.up();
  await p.waitForTimeout(1800);
};
const desce = (p, suave = false) => p.evaluate(s => scrollTo({ top: document.documentElement.scrollHeight, behavior: s ? 'smooth' : 'instant' }), suave);

module.exports = { centro, tem, pousa, passa, agarra, arrasta, solta, rolaPraCima, joga, desce };
