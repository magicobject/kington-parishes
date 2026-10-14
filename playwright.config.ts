import { defineConfig, devices } from '@playwright/test';

// (PW_PORT lets the launch rehearsal run this suite in a temporary copy on its own port, never reusing a server from the real repo)
const PORT = Number(process.env.PW_PORT ?? 4176);

export default defineConfig({
  testDir: './test',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npx tsx test/support/static-server.ts`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
