const { defineConfig } = require('@playwright/test');
const { defineBddConfig } = require('playwright-bdd');

const testDir = defineBddConfig({ features: 'features/*.feature', steps: 'passos/*.cjs', language: 'pt', outputDir: '.gerado' });

module.exports = defineConfig({
  testDir,
  outputDir: '.resultados',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['./_bonito.cjs'], ['github']] : [['./_bonito.cjs']],
  use: {
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined },
  },
});
