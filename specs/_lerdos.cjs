const path = require('path');
class Lerdos {
  constructor() { this.t = []; }
  onTestEnd(test, r) { this.t.push([r.duration, path.basename(test.location.file, '.spec.js'), test.title]); }
  onEnd() {
    console.log('\nmais lerdos:');
    for (const [ms, arq, nome] of this.t.sort((a, b) => b[0] - a[0]).slice(0, 5)) console.log(`  ${(ms / 1000).toFixed(1)}s  ${arq} › ${nome}`);
  }
  printsToStdio() { return false; }
}
module.exports = Lerdos;
