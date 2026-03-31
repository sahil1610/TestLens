<p align="center">
  <img src="assets/testlens-logo.svg" alt="TestLens" width="420" />
</p>

<p align="center">
  <strong>Fast, human-readable Playwright failure summaries.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/testlens-playwright">
    <img alt="npm" src="https://img.shields.io/npm/v/testlens-playwright?color=0ea5e9&logo=npm" />
  </a>
  <a href="https://www.npmjs.com/package/testlens-playwright">
    <img alt="npm downloads" src="https://img.shields.io/npm/dm/testlens-playwright?color=64748b" />
  </a>
  <a href="https://github.com/sahil1610/TestLens/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/sahil1610/TestLens/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="LICENSE">
    <img alt="license" src="https://img.shields.io/badge/license-MIT-22c55e" />
  </a>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> ·
  <a href="#example-output">Example output</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#cli">CLI</a>
</p>

> `testlens-playwright` prints a concise, end-of-run summary explaining **why Playwright tests failed** in CI—optimized for fast debugging, not dashboards.

## What you get

- **Failure-focused summary** at the end of the run
- **Network aggregation** (method/status/url) for \(>= 400\) responses
- **Flake detection** (passed on retry)
- **Console/pageerror signals** when API signal is absent

<details>
<summary><strong>Failure classification (MVP heuristics)</strong></summary>

- API status \(>= 500\) → Backend Issue  
- API status \(400–499\) → Client/Test Data Issue  
- Passed on retry → Flaky Test  
- Timeout and no API failure → Test Issue  
- Console/pageerror with no API signal → Test Issue  

</details>

## Requirements

- Node.js (modern LTS recommended)
- `@playwright/test` `>= 1.40.0` (peer dependency)

## Install

```bash
npm i -D testlens-playwright
```

## Quickstart

### 1) Adopt once

Playwright reporters can’t subscribe to `page` network/console events directly. TestLens bridges that by installing small hooks in a shared test wrapper, then having specs import that wrapper.

Run:

```bash
npx testlens-playwright adopt
```

This creates `tests/test.ts` and rewrites imports inside `tests/` to point to it (with correct relative paths).

### 2) Enable the reporter

In `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['testlens-playwright/reporter']],
});
```

### 3) Write tests normally

After adoption, your specs import from the wrapper:

```ts
import { test, expect } from './test';

test('example', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/example/i);
});
```

## Example output

```
----------------------------------
TestLens Failure Summary
----------------------------------

FAIL Checkout Flow
Likely Cause: Backend Issue
Reason: POST https://api.example.com/orders returned 500 (3 times)
Confidence: High

FLAKY Search Test
Likely Cause: Flaky Test
Reason: Passed on retry
Confidence: High

----------------------------------
Summary:
- Total failed tests: X
- Flaky tests: Y
----------------------------------
```

## How it works

Playwright reporter plugins can’t directly subscribe to `page` events. TestLens uses:
- a small **in-test hook** (installed via the wrapper) to capture signals and attach a compact JSON summary to each test result
- a **reporter** that reads those attachments and prints a focused end-of-run summary

<details>
<summary><strong>Data captured (per test)</strong></summary>

- test title + status + retry count + error message
- network aggregates: `{ method, status, url, count }` for responses \(>= 400\)
- console aggregates: `console.error` and `pageerror` messages with counts
- URL redaction: querystring/hash stripped before aggregation

</details>

## CLI

### `adopt` command reference

```bash
npx testlens-playwright adopt [--dir <testsDir>] [--wrapper <path>] [--dry-run]
```

- **`--dir`**: directory containing specs (default `tests`)
- **`--wrapper`**: wrapper path (default `<dir>/test.ts`)
- **`--dry-run`**: prints what would change (no files written)

<details>
<summary><strong>Configuration</strong></summary>

#### Colors

- Default: auto-detected (TTY only)
- Force on: `TESTLENS_COLOR=always`
- Force off: `TESTLENS_COLOR=never`
- Respects `NO_COLOR` / `FORCE_COLOR`

#### Capture scope

- Network: records responses with status \(>= 400\) (by design, to avoid noise)
- URLs: querystring/hash are stripped before aggregation

</details>

<details>
<summary><strong>Troubleshooting</strong></summary>

#### I don’t see network signals

- Ensure your specs import from the wrapper created by `adopt` (e.g. `import { test } from './test'`).
- If your tests are not under `tests/`, re-run adoption with `--dir`.

#### I only see console/pageerror reasons

Often the test failed before any API calls were made, or the failure isn’t represented by an HTTP response (DNS issues, request never left, etc.). MVP focuses on HTTP status + console/page errors.

#### Colors look weird in CI

- Set `TESTLENS_COLOR=never` or `NO_COLOR=1`
- Or force colors with `TESTLENS_COLOR=always` if your CI supports it

</details>

## Development

```bash
npm test
```

```bash
npm run test:integration
```

<details>
<summary><strong>Scope / non-goals</strong></summary>

- No UI dashboard
- No database / cloud sync
- No auth

</details>



