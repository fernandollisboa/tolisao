// o gorro de natal da diva: desenha o diva-natal.png a partir do diva.png (node specs/gorro.cjs).
// a ficha é redonda e o border-radius corta o que sai do círculo, então o gorro mora dentro dele, torto na cabeça
const { chromium } = require('./_pw.cjs');
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const face = 'data:image/png;base64,' + fs.readFileSync(path.join(raiz, 'diva.png')).toString('base64');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM }); const p = await b.newPage();
  await p.setContent('<canvas id=c width=512 height=512></canvas>');
  const url = await p.evaluate(async (face) => {
    const c = /** @type {HTMLCanvasElement} */ (document.getElementById('c')), x = c.getContext('2d');
    const img = new Image(); img.src = face; await img.decode();
    x.drawImage(img, 0, 0, 512, 512);
    // tudo preso no círculo da ficha (o aro marrom fica por cima, redesenhado no fim)
    x.save(); x.beginPath(); x.arc(256, 256, 236, 0, 7); x.clip();
    x.translate(236, 112); x.rotate(-0.28); x.scale(0.82, 0.82);
    // o pano vermelho: sobe da faixa, dobra pra direita e cai com o pompom
    const pano = new Path2D('M -175 30 C -155 -75 -40 -150 70 -138 C 160 -128 215 -60 215 40 C 195 -10 150 -50 110 -45 C 140 -15 165 5 180 30 Z');
    const g = x.createLinearGradient(-150, -130, 180, 40); g.addColorStop(0, '#e8323c'); g.addColorStop(1, '#a3121c');
    x.fillStyle = g; x.fill(pano);
    x.lineWidth = 10; x.strokeStyle = '#5e0a10'; x.lineJoin = 'round'; x.stroke(pano);
    // brilho do pano
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 12; x.lineCap = 'round';
    x.beginPath(); x.moveTo(-100, -40); x.quadraticCurveTo(-40, -110, 50, -115); x.stroke();
    // a faixa branca, felpuda
    const faixa = (cor, lw) => { x.fillStyle = cor; x.strokeStyle = '#8b8b8b'; x.lineWidth = lw;
      x.beginPath(); x.roundRect(-195, 10, 395, 64, 32); x.fill(); x.stroke(); };
    faixa('#fbfbf6', 8);
    x.fillStyle = '#e4e2da';
    for (const [cx, cy, r] of [[-150, 50, 12], [-95, 34, 10], [-40, 52, 12], [20, 36, 10], [80, 54, 12], [140, 38, 10]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
    // o pompom
    x.fillStyle = '#fbfbf6'; x.strokeStyle = '#8b8b8b'; x.lineWidth = 8;
    x.beginPath(); x.arc(215, 62, 42, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#e4e2da'; x.beginPath(); x.arc(228, 78, 14, 0, 7); x.fill();
    x.restore();
    // o aro marrom da diva por cima, como no original
    x.beginPath(); x.arc(256, 256, 243, 0, 7); x.lineWidth = 22; x.strokeStyle = '#6b4a2b'; x.stroke();
    return c.toDataURL('image/png');
  }, face);
  fs.writeFileSync(path.join(raiz, 'diva-natal.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log('diva-natal.png');
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
