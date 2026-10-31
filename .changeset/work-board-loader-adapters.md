---
"@shivaedev/work-board": minor
---

### Breaking

- Move the browser client to its adapter module. Import `browserClient`, `BrowserClient` and `Reader` from `@shivaedev/work-board/adapters/browserClient.ts` instead of `@shivaedev/work-board/browserClient.ts`.

### Fixed

- Preserve router cancellation and browser client services when running Work Board Effects through library callback adapters.
