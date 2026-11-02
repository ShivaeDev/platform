---
"@shivaedev/quality": minor
---

### Breaking

- Import analysis composes as Effect through the compiler adapter service. Consumers of `importGraph`, `departures`, `browserGlobals`, `checkFences` and `entryPointFindings` must compose or yield their Effects; `importGraph`, `departures`, `checkFences` and `entryPointFindings` no longer return Promises, and `browserGlobals` no longer returns findings synchronously. Compiler-adapter failures use `ImportAnalysisFailure` in the error channel. Consumers importing `Project`, `projectsFor` or resolution functions must use `adapters/imports/projects.ts` or `adapters/imports/resolve.ts`; the `Endpoint` type moves to `imports/Endpoint.ts`.
