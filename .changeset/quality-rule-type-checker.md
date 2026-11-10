---
"@shivaedev/quality": minor
---

### Added

- Rule inputs carry `typeScript`, an Effect of a TypeScript program, its type checker and the `ts` module that built them, over the scanned sources, so local rules can read types without importing Quality's internal modules or their own `typescript`. Every rule in a run that asks for it receives the same program, built at most once and only on first use. A configured check called by hand builds one from `root` and `sources` when its inputs leave `typeScript` out.

### Breaking

- A value annotated as `RuleInputs` must now include `typeScript`. Pass the inputs to a configured check without it, where it is optional, or build one with `typeScriptProgram(root, sources)` from `@shivaedev/quality/adapters/typeScriptProgram.ts`.
