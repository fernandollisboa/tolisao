let pw; try { pw = require('@playwright/test'); } catch { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
module.exports = pw;
