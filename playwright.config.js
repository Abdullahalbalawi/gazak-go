import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/gazak-go/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'VITE_DEMO_MODE=true VITE_GITHUB_PAGES=true VITE_CARD_PAYMENTS_ENABLED=false VITE_SUPABASE_URL=https://preview-placeholder.supabase.co VITE_SUPABASE_ANON_KEY=preview-placeholder-anon-key npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/gazak-go/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
