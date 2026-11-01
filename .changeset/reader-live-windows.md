---
"@shivaedev/react": minor
---

### Breaking

- Direct callers of `@shivaedev/react/client/mountLive.ts` now run `mountLive(client, window)` as an Effect requiring `AtomRegistry.AtomRegistry`, instead of passing the registry as its first argument. Provide the registry with `Effect.provideService(AtomRegistry.AtomRegistry, registry)` and call the returned cleanup when the reader unmounts.

### Fixed

- Keep live coalescing overrides owned by each query reader, so removing a reader restores the remaining reader's override. Clearing a session's live coalescing override restores the binding's original window.
