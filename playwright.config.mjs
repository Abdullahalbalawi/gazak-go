import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/stage21',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'env VITE_DEMO_MODE=true VITE_GITHUB_PAGES=false VITE_CARD_PAYMENTS_ENABLED=false npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
