---
"@shivaedev/react": minor
---

### Added

- Expose the native submission `cause` on `useEditor`, `useCreate` and `SaveState` so applications can render failures that include defects.

### Fixed

- Stop sign-out follow-up navigation on component unmount or registry disposal and ignore repeated dispatch while sign-out is pending.
