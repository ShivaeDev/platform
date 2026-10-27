---
"@shivaedev/react": minor
---

### Added

- `useSignOut` coordinates explicit sign-out with TanStack Router so `permissionGuard` and `signInSearch` omit the return target during the following session refresh.
- `authQuery` turns Better Auth reads into input-keyed native query atoms, preserving typed auth errors, mapping rejected promises to `AuthActionUnavailable`, and aborting pending requests when their readers unmount.

### Fixed

- Session boundaries deliver the latest committed `recheck` to query, action and save hooks without repeating a refused result when the callback changes identity.
