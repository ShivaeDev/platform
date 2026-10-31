---
"@shivaedev/react": minor
"@shivaedev/create-app": minor
---

### Added

- React's `permissionGuard` accepts `staticData.signedIn: true` for routes that require a session without a permission grant. Signed-out viewers use the existing sign-in redirect and return location; undeclared routes remain public and matched permission requirements still apply.

### Changed

- Generated apps declare the notes routes as signed-in-only and install `permissionGuard` once at the root, redirecting signed-out viewers before loading notes.
