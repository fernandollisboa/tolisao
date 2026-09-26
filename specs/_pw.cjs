let pw; try { pw = require('@playwright/test'); } catch { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
// sem o navegador da versão do playwright instalada (máquina com outro chromium já baixado,
// como a da nuvem), usa o chromium mais novo que achar na pasta dos navegadores
if (!process.env.PW_CHROMIUM) {
  const fs = require('fs'), path = require('path'), os = require('os');
  let esperado = ''; try { esperado = pw.chromium.executablePath(); } catch {}
  if (!esperado || !fs.existsSync(esperado)) {
    const pasta = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache', 'ms-playwright');
    const achado = (fs.existsSync(pasta) ? fs.readdirSync(pasta) : [])
      .filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1])
      .flatMap(d => ['chrome-linux64/chrome', 'chrome-linux/chrome'].map(f => path.join(pasta, d, f)))
      .find(f => fs.existsSync(f));
    if (achado) process.env.PW_CHROMIUM = achado;
  }
}
module.exports = pw;
