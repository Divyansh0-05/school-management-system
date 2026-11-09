import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    { command: 'npm --prefix ../api run dev', url: 'http://127.0.0.1:5000/health', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm run dev', url: 'http://127.0.0.1:3000/login', reuseExistingServer: true, timeout: 120_000 },
  ],
});
