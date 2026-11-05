# Changelog

## 0.6.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.

## 0.5.0 - 2026-11-05

### Breaking

- Removes `BrowserLocator`, `BrowserSocket` and the `BrowserPage` methods `click`, `fill`, `waitFor`, `socket` and `navigationCount`. Use `BrowserPage.visit`, `checkText` and `screenshot` for local page checks, and application stories for behavior. Consumers that need arbitrary browser interactions or WebSocket inspection can use Playwright directly.

## 0.4.1 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.4.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.3.0 - 2026-11-03

### Added

- Exports the generic `Browser`, `BrowserPage`, `BrowserSocket` and `BrowserCheckError` modules and the Playwright Layer at `adapters/playwright.ts` for application-owned Effect scenarios.

### Breaking

- Removes `browser-check --live-notes`. Run `pnpm browser-check:live-notes` in the starter or an app generated from the new template, with `BROWSER_CHECK_EMAIL` and `BROWSER_CHECK_PASSWORD` set. Copy the starter's notes scenario into existing apps that need the same check; the shared CLI now handles only generic page, text and screenshot checks.
- Programmatic browser consumers now provide the `playwright` Layer from `@shivaedev/browser-check/adapters/playwright.ts` instead of `Browser.layer`. Replace `session.visit`, `session.checkText` and `session.screenshot` with operations on `yield* session.newPage`. Replace `session.checkLiveNotes` and `CheckOptions.liveNotes` with the starter-owned `liveNotes` scenario. The adapter’s `playwright` export is now a Layer: use it directly instead of `Layer.effect(Browser, playwright)`. The former `adapters/liveNotes.ts` scenario and `adapters/rpcFrames.ts` predicates (`rpcHint` and `rpcListRequest`) live in the starter’s `tooling/notes/browser-check` folder.

## 0.2.3 - 2026-11-02

### Fixed

- Launch the cached Chromium executable checked for readiness, including when the separate headless shell is absent.
- Clear previous screenshots before each check so shorter and failed runs leave only their own captures.
- Skip hidden text matches when checking for visible text, while still failing when all matches are hidden.
- Reject invalid base and page URLs with a browser-check diagnostic before installing or opening Chromium.
- Failed or interrupted live-notes checks handle pending WebSocket waits without unhandled rejections. Live verification requires RPC hint chunks and a `notes.list` request instead of matching words in unrelated frames.

## 0.2.2 - 2026-11-01

### Fixed

- Report production imports of the `@effect/platform-node` barrel with module subpaths that avoid loading optional integrations such as redis.
- Recognize native Effect `catchTags` record keys regardless of the handler body while retaining diagnostics for actual nested component and hook factories.
- Keep a constant's matching filename valid when the constant becomes private.
- Name each conflicting fix and format pass's file and line/column range when `quality fix` cannot settle.
- Use Node platform module subpaths in package runtimes and commands instead of loading the barrel.

## 0.2.1 - 2026-10-31

### Fixed

- Include `CHANGELOG.md` in published package contents so release notes are available in `node_modules`.
- Release checks reject published package `files` lists that omit `CHANGELOG.md`, naming the package and how to include it.

## 0.2.0 - 2026-10-30

### Added

- Opt-in `--live-notes` smoke check for the running starter: verify a second tab receives a socket hint and rereads a created note without navigation, then loses its live socket and private notes after sign-out in the first tab. Use an existing disposable user through `BROWSER_CHECK_EMAIL` and `BROWSER_CHECK_PASSWORD`.

## 0.1.0 - 2026-10-30

### Added

- Inspect running apps locally with browser-check screenshots, test-user sign-in and smoke checks, installing Chromium only when the command runs.
- Give generated apps an opt-in browser-check script and ignored screenshot folder, outside app CI and ready checks.
