let pw; try { pw = require('@playwright/test'); } catch { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
// sem o navegador da versão do playwright instalada (máquina com outro chromium já baixado,
// como a da nuvem), usa o mais novo que achar na pasta dos navegadores. O headless shell primeiro,
// que é o que o playwright usa sem janela: o chromium inteiro deixava a rodada uns 20% mais lenta
if (!process.env.PW_CHROMIUM) {
  const fs = require('fs'), path = require('path'), os = require('os');
  let esperado = ''; try { esperado = pw.chromium.executablePath(); } catch {}
  if (!esperado || !fs.existsSync(esperado)) {
    const pasta = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache', 'ms-playwright');
    const pastas = fs.existsSync(pasta) ? fs.readdirSync(pasta) : [];
    const acha = (nome, arquivos) => pastas
      .filter(d => new RegExp(`^${nome}-\\d+$`).test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1])
      .flatMap(d => arquivos.map(f => path.join(pasta, d, f)))
      .find(f => fs.existsSync(f));
    const achado = acha('chromium_headless_shell', ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/headless_shell'])
      || acha('chromium', ['chrome-linux64/chrome', 'chrome-linux/chrome']);
    if (achado) process.env.PW_CHROMIUM = achado;
  }
}
module.exports = pw;
