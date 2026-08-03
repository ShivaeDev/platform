# ShivaeDev Platform

Reusable TypeScript packages for Effect-based applications.

This repository is under construction. Published packages may change quickly
before 1.0.

## Packages

- [`@shivaedev/effect-prisma`](./packages/effect-prisma): Effect-native
  PostgreSQL queries and transactions for Prisma Next.
- [`@shivaedev/effect-trpc`](./packages/effect-trpc): Effect-native tRPC
  procedures and testing.
- [`@shivaedev/platform`](./packages/platform): Opinionated application test
  setup combining the shared Prisma and tRPC integrations.

## Development

Requirements:

- Node.js 24
- pnpm 11

```sh
corepack enable
pnpm install
pnpm ready
```
