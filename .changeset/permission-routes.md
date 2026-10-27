---
"@shivaedev/react": minor
---

### Added

- Read session grants with `can` and `useCan`, guard TanStack routes with `staticData.permission` and `permissionGuard`, and render one `PermissionBoundary` fallback for refused routes and forbidden queries. Signed-out route visits redirect to the application's sign-in path with their return location.
