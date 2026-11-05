---
"@shivaedev/quality": minor
---

### Breaking

- Import `ImportCompiler` from `@shivaedev/quality/adapters/import-compiler/service.ts` instead of `@shivaedev/quality/adapters/ImportCompiler.ts`. Its methods and single Layer remain the same.
- Replace direct imports of `analyzeGraph`, `analyzeDepartures` and `checkBrowser` from the corresponding `@shivaedev/quality/adapters/imports/` modules with `graph`, `departures` and `browserChecker` from the corresponding `@shivaedev/quality/adapters/import-compiler/` modules. Their spans now match the service operations: `ImportCompiler.graph`, `ImportCompiler.departures` and `ImportCompiler.browserChecker`.
