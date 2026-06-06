import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5175',
    trace: 'retain-on-failure',
    viewport: { width: 1680, height: 945 }
  },
  webServer: {
    command: 'pnpm dev --port 5175',
    url: 'http://127.0.0.1:5175/canvas/',
    reuseExistingServer: false,
    env: {
      VITE_LINK_PREVIEW_ENDPOINT: ''
    }
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1680, height: 945 }
      }
    }
  ]
});
