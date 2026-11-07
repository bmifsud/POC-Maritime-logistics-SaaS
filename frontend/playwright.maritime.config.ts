import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: './tests/maritime',
  outputDir: './test-results-maritime',
  fullyParallel: true,
  forbidOnly: true,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: process.env.MARITIME_DEMO === '1' ? 1 : undefined,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR ?? '../artifacts/maritime-report', open: 'never' }], ['json', { outputFile: '../artifacts/maritime-results.json' }]],
  globalSetup: path.resolve(import.meta.dirname, 'global.setup.ts'),
  use: {
    baseURL: process.env.MARITIME_BASE_URL ?? 'http://127.0.0.1:4300',
    storageState: path.resolve(import.meta.dirname, '.auth/maritime.json'),
    headless: process.env.HEADED !== '1',
    viewport: { width: 390, height: 844 },
    locale: 'en-NZ',
    timezoneId: 'Pacific/Auckland',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--no-sandbox'] },
  },
  webServer: {
    command: 'node support/maritime/server.mjs',
    url: 'http://127.0.0.1:4300/health',
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
