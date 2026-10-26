---
"@shivaedev/platform": minor
---

### Breaking

- Remove `@shivaedev/effect-prisma`, the Prisma Next integration. Applications on Prisma stay on its last published version; the native path is `@shivaedev/sql` repositories over Effect SQL.
- Remove `@shivaedev/effect-changes-prisma`, the Prisma Classic change recorder. Applications on Prisma stay on its last published version; the native path is `@shivaedev/changes` bound through `@shivaedev/sql`.
- Remove `@shivaedev/effect-trpc`, the tRPC integration. Applications on tRPC stay on its last published version; the native path is Effect RPC declared through `@shivaedev/contract`.
- Remove Platform's Prisma and tRPC adapters: `server/better-auth/adapter.ts` (`effectPrismaAdapter`) and `server/testing/makePlatformIt.ts` with its types. Better Auth runs on its own `pg` pool through `server/better-auth/mount.ts`, and tests use `@shivaedev/test-story` kits.
- Move `http-client/*` to `@shivaedev/http`: import `body.ts`, `errors.ts`, `filterStatus.ts`, `nextLink.ts`, `paginate.ts` and `parseRetryAfter.ts` from `@shivaedev/http/...`.
- Move `server/boundedBody.ts` to `@shivaedev/http/server/boundedBody.ts`.
- Move `server/rpc-server/sensitive.ts`, `server/rpc-server/redact.ts` and `server/rpc-server/redactCause.ts` to `@shivaedev/errors/sensitive.ts`, `@shivaedev/errors/redact.ts` and `@shivaedev/errors/redactCause.ts`, and `server/rpc-server/boundary.ts` to `@shivaedev/errors/boundary.ts`.
- Move request identity to `@shivaedev/identity`: `rpc/identity.ts`, `rpc/middleware.ts` and `rpc/permission.ts` become `@shivaedev/identity/identity.ts`, `@shivaedev/identity/middleware.ts` and `@shivaedev/identity/permission.ts`; `server/rpc-server/{session,sessionKeys,sessionProfile,revalidateStream,origin,local,transportHeaders,trustedProxy,trustedProxyRanges,proxyRanges,permissions,resolveRole,tracing}.ts` become `@shivaedev/identity/server/<name>.ts`; `server/rpc-server/adapters/betterAuthSessions.ts` becomes `@shivaedev/identity/server/adapters/betterAuthSessions.ts`; `server/commandChanges.ts` becomes `@shivaedev/identity/server/commandChanges.ts`; and every `server/better-auth/` module except `users.ts` becomes `@shivaedev/identity/server/better-auth/<name>.ts`. The service and middleware ids change from `@shivaedev/platform/rpc/<Name>` to `@shivaedev/identity/<Name>`.
- Move app-user management to `@shivaedev/admin`: `rpc/userRoles.ts` becomes `@shivaedev/admin/users/roles.ts` and `server/better-auth/users.ts` becomes `@shivaedev/admin/server/users.ts`.
