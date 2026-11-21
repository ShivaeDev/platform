---
"@shivaedev/quality": minor
---

### Added

- `imports/runtime` reports a named import or re-export of `RouterProvider` from `@tanstack/react-router` in production code of a package that depends on `@shivaedev/react`, directly or through `@shivaedev/platform`. TanStack's provider does not tell `useFirstSettled` when the first route has rendered, so a first screen held for it is revealed onto loading states. On upgrade an application that still mounts TanStack's provider gets one finding per import; change it to `import { RouterProvider } from "@shivaedev/react/RouterProvider.ts"`, which takes the same props. Specs and `test-support/` are not checked.
