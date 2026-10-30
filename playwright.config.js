import { defineConfig, devices } from '@playwright/test';

const APP_PORT = 5199;
const MOCK_PORT = 54399;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  workers: 1,            // tests share one stub auth server
  timeout: 60_000,       // generous: dev machines running other servers can stall for 30 s+ (no retries, so real failures still fail)
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${APP_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/mock-supabase.mjs',
      url: `http://localhost:${MOCK_PORT}/__test/state`,
      env: { MOCK_PORT: String(MOCK_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${APP_PORT} --strictPort`,
      url: `http://localhost:${APP_PORT}`,
      // Both names are set so a developer's own .env.local can never leak into the test run.
      env: {
        VITE_SUPABASE_URL: `http://localhost:${MOCK_PORT}`,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
        VITE_SUPABASE_ANON_KEY: 'test-publishable-key',
      },
      reuseExistingServer: false,
    },
  ],
});
