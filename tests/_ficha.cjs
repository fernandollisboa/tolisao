const centro = async p => { const b = await p.locator('.stain').boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const tem = (p, classe) => p.evaluate(c => document.querySelector('.stain').classList.contains(c), classe);
const pousa = async (p, timeout = 12000) => { await p.waitForSelector('.stain.pousou', { timeout }); await p.waitForTimeout(500); };
const cutuca = async (p, vezes) => {
  const o = await centro(p); await p.mouse.move(o.x, o.y, { steps: 8 }); await p.waitForTimeout(300);
  for (let i = 0; i < vezes; i++) { await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(550); }
};
const agarra = async p => { await p.mouse.down(); await p.waitForTimeout(250); };
const arrasta = async (p, x, y) => { await p.mouse.move(200, 380, { steps: 40 }); await p.mouse.move(x, y, { steps: 30 }); await p.waitForTimeout(250); };
const solta = async p => { await p.mouse.up(); await p.waitForTimeout(500); };
const rolaPraCima = async p => {
  const antes = await p.evaluate(() => scrollY), o = await centro(p);
  await p.mouse.wheel(0, -500); await p.waitForTimeout(900);
  return { rolou: antes - await p.evaluate(() => scrollY), andou: (await centro(p)).y - o.y };
};
const joga = async p => {
  const o = await centro(p); await p.mouse.move(o.x, o.y, { steps: 8 }); await p.mouse.down(); await p.waitForTimeout(250);
  await p.mouse.move(o.x + 40, o.y + 10, { steps: 6 }); await p.mouse.move(o.x + 220, o.y - 120, { steps: 3 }); await p.mouse.up();
  await p.waitForTimeout(1800);
};
const senha = async (p, sel) => {
  const b = await p.locator(sel).boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  for (const ms of [650, 90, 650]) { await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); await p.waitForTimeout(250); }
};
const estado = p => p.evaluate(() => ({ chato: document.body.classList.contains('chato'), frase: document.querySelector('#signoff').textContent,
  subtitulo: getComputedStyle(document.querySelector('#tagline')).display, ficha: getComputedStyle(document.querySelector('.stain')).display }));
const desce = (p, suave = false) => p.evaluate(s => scrollTo({ top: document.documentElement.scrollHeight, behavior: s ? 'smooth' : 'instant' }), suave);

module.exports = { centro, tem, pousa, cutuca, agarra, arrasta, solta, rolaPraCima, joga, senha, estado, desce };
