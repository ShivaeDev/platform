---
"@shivaedev/react": minor
"@shivaedev/create-app": minor
---

### Added

- `SessionBoundary` accepts `redirectTo` and an optional `navigate` callback to continue sign-in through a same-origin URL replacement after unmounting the signed-out tree and before mounting the signed-in tree. Unsafe targets fall back to `/`.

### Fixed

- Generated apps let the boundary hand off sign-in navigation and identify cookie sessions by user id, preserving signed-in screen state when a session rotates after a password change.
