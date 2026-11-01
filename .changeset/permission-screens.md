---
"@shivaedev/react": minor
---

### Added

- React exposes an Effect `PermissionSession` schema alongside its inferred session type, using access's shared permission codec.
- React session reads expose typed permission grants while preserving provider fields.
- React supplies `Forbidden` with a router link back to an allowed route, and `PermissionBoundaryError` for route failures inside the router.

### Breaking

- React's `authSession` now requires a nullable session with a `user` object and validates its permission grants. Use `authQuery` for reads of other payload shapes; remove application session permission decoders when using `authSession`.
- `PermissionSession` is now a schema-derived type. Extend it with an intersection or an application interface rather than module augmentation.
