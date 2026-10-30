# Changelog

## 0.2.0 - 2026-10-30

### Added

- Access exports the `Permission` Schema and derives its type from it. Role resolution and identity session decoding use that Schema.
- Access exports `forbidden(permission)` and `unauthorized()` from `refusal.ts` for consistent permission refusals.

### Breaking

- `roleSet` refuses a role name declared more than once with a compile error. Previously `hasPermission` granted the union of every declaration's grants while `resolve` returned only the first declaration's, so the two disagreed. Merge the grants of repeated roles into one `role(...)` declaration.
- `roleSet` now infers its type parameter from the tuple of roles instead of the union of their names, so `typeof roleSet<TName>` no longer names a role set. Replace `ReturnType<typeof roleSet<TName>>` with `AccessPolicy<TName>` from `@shivaedev/access/roleSet.ts`.
- Access, identity and React now share access's grant evaluator: an `any` grant covers an `own` check for the same permission name. An `own` grant still cannot cover an `any` check. Applications that need separate capabilities must declare separate permission names; record ownership checks still belong in `canAccess` or `requireAccess`.
- Replace `Access.requirePermission(user, permission)` with `requirePermission(yield* Access.resolve(user.role), permission)` from `@shivaedev/access/requirePermission.ts`. The new function takes a signed-in user; reject an absent session with `unauthorized()` from `@shivaedev/access/refusal.ts` before resolving its role. `requireAccess` continues to handle signed-out users itself.
- Replace identity's `requirePermission(permission)` with access's `requirePermission(yield* SessionUser, permission)`. There is no identity re-export. Admin's built-in handlers use this shared enforcement.
- Access's `requireAccess` now uses the shared permission refusal message, `Permission required: <name> (<strength>)`, instead of `Access denied: <name>`. Consumers should branch on the `Forbidden` tag.

## 0.1.2 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

## 0.1.1 - 2026-10-27

### Changed

- Read the shared expected failures from `@shivaedev/errors`, the package they moved to from `@shivaedev/contract`.

## 0.1.0 - 2026-10-26

### Added

- Declare application permissions, explicit role grants and a closed role-name Schema in the browser-safe `@shivaedev/access` package. Check exact permissions and record ownership with predicates or typed `Forbidden` and `Unauthorized` enforcement effects.
- Access role sets resolve stored role strings into their decoded role and declared permissions.
- Platform resolves application roles per request, exposes grants to handlers and the client session, and enforces declared permissions on RPCs and HTTP routes.

### Breaking

- Platform removes `requireAdmin`, `hasRole`, `AuthenticatedAdmin`, `AuthenticatedOwner`, their Layers, and `adminRoute`. Declare roles and permissions with `@shivaedev/access`, pass the role set once in `betterAuthMount(options, { roles })` and reuse its returned `sessions`, or configure `sessions.roles` for another provider. Replace role middleware with a class extending `permissionMiddleware<Self>()(id, permission)`, provide `permissionLayer(Middleware, sessions)`, and use `permissionRoute(sessions, permission)` for HTTP routes. Read `SessionUser.permissions` or the client session's `user.permissions` with `hasPermission`; use the application's access policy for record ownership. Unknown stored roles fail visibly and must be migrated to declared strings.
- Admin pages require `AdminPermission` from `@shivaedev/admin/permissions.ts`. Grant its `OpenAdmin` permission to the application's operator roles and provide `permissionLayer(AdminPermission, sessions)`. User role writes and controls require Platform's `ChangeUserRoles` permission. The existing admin role-list editor and last-owner invariant retain their storage format; declare its stored combinations in the application role set until migrating that editor.
