---
"@shivaedev/browser-check": minor
"@shivaedev/create-app": minor
---

### Breaking

- `@shivaedev/browser-check`: Removes `browser-check --live-notes`. Run `pnpm browser-check:live-notes` in the starter or an app generated from the new template, with `BROWSER_CHECK_EMAIL` and `BROWSER_CHECK_PASSWORD` set. Copy the starter's notes scenario into existing apps that need the same check; the shared CLI now handles only generic page, text and screenshot checks.
- `@shivaedev/create-app`: Generates the notes browser scenario in full apps under `tooling/notes/browser-check` (minimal apps omit it) and exposes it as `browser-check:live-notes`. After applying a template update, replace `pnpm browser-check --live-notes` with `pnpm browser-check:live-notes`; `--url` and the existing credential variables still apply.
- `@shivaedev/browser-check`: Programmatic browser consumers now provide the `playwright` Layer from `@shivaedev/browser-check/adapters/playwright.ts` instead of `Browser.layer`. Replace `session.visit`, `session.checkText` and `session.screenshot` with operations on `yield* session.newPage`. Replace `session.checkLiveNotes` and `CheckOptions.liveNotes` with the starter-owned `liveNotes` scenario. The adapter’s `playwright` export is now a Layer: use it directly instead of `Layer.effect(Browser, playwright)`. The former `adapters/liveNotes.ts` scenario and `adapters/rpcFrames.ts` predicates (`rpcHint` and `rpcListRequest`) live in the starter’s `tooling/notes/browser-check` folder.

### Added

- `@shivaedev/browser-check`: Exports the generic `Browser`, `BrowserPage`, `BrowserSocket` and `BrowserCheckError` modules and the Playwright Layer at `adapters/playwright.ts` for application-owned Effect scenarios.

### Fixed

- `@shivaedev/create-app`: Generated apps adapt the default module factory to the session connection callback. The callback's registry argument no longer replaces the factory's optional registrations list, so signed-in and anonymous screens render without the `Not a valid effect: ~effect/reactivity/AtomRegistry` failure. Existing apps can apply the template update or change the default connection in `SessionApp` to `(session) => clientModules(session)`.

- `@shivaedev/create-app`: The local notes scenario allows the host’s normal 30-second session revalidation period and checks the current sign-in screen after sign-out.
