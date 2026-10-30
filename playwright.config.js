import { defineConfig, devices } from '@playwright/test';

const APP_PORT = 5199;
const MOCK_PORT = 54399;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  workers: 1,            // tests share one stub auth server
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
      env: { VITE_SUPABASE_URL: `http://localhost:${MOCK_PORT}`, VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
      reuseExistingServer: false,
    },
  ],
});
