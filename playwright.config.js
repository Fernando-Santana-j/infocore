const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:3133', trace: 'retain-on-failure' },
  webServer: { command: 'GOOGLE_REVIEWS_PUBLIC_SYNC=0 GOOGLE_REVIEWS_CACHE_FILE=memory PRODUCT_CATALOG_SYNC=0 PRODUCT_CATALOG_CACHE_FILE=memory PORT=3133 node index.js', url: 'http://127.0.0.1:3133', reuseExistingServer: false, timeout: 15000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'reduced-motion', use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce', viewport: { width: 1024, height: 768 } } },
  ],
});
