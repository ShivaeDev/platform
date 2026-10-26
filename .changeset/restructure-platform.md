---
"@shivaedev/platform": minor
---

### Breaking

- Remove `@shivaedev/effect-prisma`, the Prisma Next integration. Applications on Prisma stay on its last published version; the native path is `@shivaedev/sql` repositories over Effect SQL.
- Remove `@shivaedev/effect-changes-prisma`, the Prisma Classic change recorder. Applications on Prisma stay on its last published version; the native path is `@shivaedev/changes` bound through `@shivaedev/sql`.
- Remove `@shivaedev/effect-trpc`, the tRPC integration. Applications on tRPC stay on its last published version; the native path is Effect RPC declared through `@shivaedev/contract`.
- Remove Platform's Prisma and tRPC adapters: `server/better-auth/adapter.ts` (`effectPrismaAdapter`) and `server/testing/makePlatformIt.ts` with its types. Better Auth runs on its own `pg` pool through `server/better-auth/mount.ts`, and tests use `@shivaedev/test-story` kits.
