---
"@shivaedev/quality": patch
---

### Fixed

- `effect/adapter-imports` and `effect/boundary` accept a tool config directly in a package's folder, such as `vitest.config.ts`, because the tool loads it from that fixed path; configs deeper in the package stay checked.
- `effect/adapter-imports` accepts `node:process` in entry modules (cli, main and entry files, `runMain` callers and the `import.meta.url` argv guard), so it no longer contradicts Biome's `noProcessGlobal`; other builtins there, and `node:process` elsewhere, stay reported.
- `effect/adapter-imports` accepts Vitest imports in every test and spec, also in packages that list Vitest as a peer; Vitest in shipped source stays reported.
- `code/unused` and `files/named-after-export` treat `.railway/postgres-schedules.ts`, which `@shivaedev/deploy` loads from its default path, as an entry that keeps its name.
- `imports/aliased` accepts relative imports between tool configs directly in a package's folder, which no `#` alias reaches.
