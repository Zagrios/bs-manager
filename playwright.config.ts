import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: "./e2e-tests",
    testMatch: "**/*.test.ts",
    timeout: 200000,
    fullyParallel: true,
    retries: 1,
});
