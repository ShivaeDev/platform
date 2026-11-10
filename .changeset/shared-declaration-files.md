---
"@shivaedev/quality": patch
---

### Changed

- `quality lint` parses each installed and TypeScript library declaration file once per run instead of once per type-aware rule, so a lint is faster with the same findings: this repository's lint took 167 s instead of 200 s and the starter's 16 s instead of 20 s.
- `typeScriptProgram(root, sources)` from `@shivaedev/quality/adapters/typeScriptProgram.ts` is an Effect that needs Quality's `services` Layer from `@shivaedev/quality/adapters/runMain.ts`; build hand-made rule inputs with `typeScript: yield* typeScriptProgram(root, sources)`.
