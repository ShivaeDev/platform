---
"@shivaedev/quality": minor
---

### Breaking

- Local rules are Effect-native. `RuleInputs.readText` returns an `Effect` of `string | undefined`, failing with `FilesystemFailure`, and a check returns findings or an `Effect` of findings; a check can no longer return a Promise. Migrate `check: async (inputs) => { const text = await inputs.readText(path); ... }` to `check: (inputs) => Effect.gen(function* () { const text = yield* inputs.readText(path); ... })`.
- `RuleInputs.signal` is removed with Promise checks. An Effect check stops when the run is interrupted; wrap a cancellable Promise API with `Effect.tryPromise({ try: (signal) => ..., catch })`, which receives the abort signal.
- The helpers that read through `readText` return Effects instead of Promises: `readPackageManifest`, `manifestEntry`, `manifestText`, `loadPackageManifests`, `workspacePackages`, `entryPointsOf`, `rootConfig`, `resolvePackage` and `discoverFences`. Replace `await helper(...)` with `yield* helper(...)`. `decodeBaseline`, `decodeLegacyBaseline`, `decodeWith` and the decoders built on it return their `Decoded` value directly, and `globMatcher` returns a `Result` that fails with `GlobFailure` instead of throwing.
