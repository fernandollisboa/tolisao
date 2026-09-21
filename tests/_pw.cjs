// resolve o playwright: dependência local (npm i -D playwright) ou instalação global
let pw; try { pw = require('playwright'); } catch { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
module.exports = pw;
