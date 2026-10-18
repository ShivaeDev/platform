---
"@shivaedev/work-board": minor
---

### Breaking

- Every module's import path is now its path under `src/`, through one `./*.ts` export. Modules that lived under `src/server/` gain a `server/` prefix, for example `@shivaedev/work-board/server/board.ts`, `server/serve.ts` and `server/integration/board.ts`. The browser client moves from `browser/client.ts` to `client/client.ts`, `browser/document/View.ts` moves to `client/document/View.ts`, and `browser/navigation/schema.ts` moves to `browser/Navigation.ts`. The other remapped paths, such as `page/escape.ts`, are gone; import the defining module instead.
