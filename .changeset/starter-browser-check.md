---
"@shivaedev/browser-check": minor
"@shivaedev/create-app": patch
---

### Changed

- `@shivaedev/create-app`: Generated apps omit the sample notes browser scenario and its dedicated command. Use `pnpm browser-check --page / --text "Sign in"` for local screenshots and visible-text checks; live updates remain covered by the changes, contract and react stories.

### Breaking

- `@shivaedev/browser-check`: Removes `BrowserLocator`, `BrowserSocket` and the `BrowserPage` methods `click`, `fill`, `waitFor`, `socket` and `navigationCount`. Use `BrowserPage.visit`, `checkText` and `screenshot` for local page checks, and application stories for behavior. Consumers that need arbitrary browser interactions or WebSocket inspection can use Playwright directly.
