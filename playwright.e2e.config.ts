import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: path.join(__dirname, 'e2e'),
  retries: 0,
  reporter: [[path.join(__dirname, 'dist', 'reporter.js')]],
});

