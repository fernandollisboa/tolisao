const { defineConfig } = require('./_pw.cjs');   // também acha o chromium da máquina
const { defineBddConfig, cucumberReporter } = require('playwright-bdd');

const testDir = defineBddConfig({ features: 'features/*.feature', steps: 'passos/*.cjs', language: 'pt', outputDir: '.gerado' });

module.exports = defineConfig({
  testDir,
  outputDir: '.resultados',
  fullyParallel: true,
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
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined },
  },
});
