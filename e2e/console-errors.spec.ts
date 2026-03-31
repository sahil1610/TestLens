import { test, expect } from '../src/fixtures';

test('shows console error signal in TestLens summary', async ({ page }) => {
  await page.setContent(`
    <html>
      <body>
        <script>
          console.error("TL_CONSOLE_ERROR: checkout failed");
        </script>
        <div id="ok">ok</div>
      </body>
    </html>
  `);

  // Force a failure so TestLens prints a summary entry for this test.
  await expect(page.locator('#missing')).toBeVisible();
});

test('shows pageerror signal in TestLens summary', async ({ page }) => {
  await page.setContent(`
    <html>
      <body>
        <script>
          setTimeout(() => { throw new Error("TL_PAGE_ERROR: something broke"); }, 0);
        </script>
      </body>
    </html>
  `);
  await page.waitForTimeout(50);

  await expect(1).toBe(2);
});

