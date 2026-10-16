const { defineConfig } = require('./_pw.cjs');   // também acha o chromium da máquina
const { defineBddConfig, cucumberReporter } = require('playwright-bdd');

const testDir = defineBddConfig({ features: 'features/*.feature', steps: 'passos/*.cjs', language: 'pt', outputDir: '.gerado' });

module.exports = defineConfig({
  testDir,
  outputDir: '.resultados',
  fullyParallel: true,
  // um worker por núcleo: o padrão do playwright é a metade, e sem o trace a máquina aguenta (4 núcleos: 78s → 53s)
  workers: '100%',
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  reporter: [
    cucumberReporter('./_pontos.cjs', { summarise: true }),
    ['./_lerdos.cjs'],
    ...(process.env.HTML ? [cucumberReporter('html', { outputFile: 'relatorio.html' })] : []),
    ...(process.env.CI ? [['github']] : []),
  ],
  use: {
    viewport: { width: 390, height: 844 },
    // sem trace: gravar tela e DOM de todo cenário pra guardar só o que falha custava 1/4 da rodada, e o CI
    // nem guarda a pasta. Pra depurar uma falha: npm test -- pix --trace on (abre com npx playwright show-trace)
    trace: 'off',
    launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined },
  },
});
