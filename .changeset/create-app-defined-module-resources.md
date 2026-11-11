---
"@shivaedev/create-app": minor
---

### Changed

- `create-app resource <name>` writes a defined module in the starter's notes shape: `<Module>.ts` with `defineModule` and the wire from `#generated/...`, a `model.ts`, and one file per operation under `server/` (`List.ts`, `Create.ts`) with `payload` and `*run`. Its registration names `module:`, its client imports the generated contract, and it no longer writes a service, a handler map, hand-written rejections or an `unavailable.ts` helper. Its output now lints cleanly as written.
- The first resource in a minimal app adds the `src/generated` entry under `imports/resolvable` in `quality.config.ts`; the command refuses before writing when the config's rules cannot take that entry.
