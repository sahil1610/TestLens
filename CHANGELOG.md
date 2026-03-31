# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0

- Initial MVP release.
- Playwright reporter that prints a failure-focused summary (likely cause + reason + confidence).
- In-test hook capturing:
  - network response aggregates (status >= 400)
  - `console.error` aggregates
  - uncaught `pageerror` aggregates
- Adoption CLI (`npx testlens-playwright adopt`) to create a shared wrapper and rewrite imports.

