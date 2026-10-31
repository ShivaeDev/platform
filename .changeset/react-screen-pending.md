---
"@shivaedev/react": minor
---

### Added

- Screen kits can build a screen driver's `pending` signal with `screenPending({ router })` from `client/screenPending.ts`, which reads the `AtomRegistry` from the environment: it reports pending while a read `AsyncResult` is waiting or the TanStack router is loading a route, and ignores results left waiting by unmounted components.
