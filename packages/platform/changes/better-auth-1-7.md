### Breaking

- The optional `better-auth` peer is now `1.7.7`. Upgrade Better Auth with Platform; Better Auth 1.7 accepts Vitest 5 as a peer.
- Better Auth 1.7 moved native joins from `experimental.joins` to `advanced.database.joins`. The Effect Prisma storage adapter still rejects native joins, and its error no longer calls them experimental.
