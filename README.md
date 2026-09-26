# ShivaeDev Platform

Reusable TypeScript packages for Effect-based applications.

This repository is under construction. Published packages may change quickly
before 1.0.

## Native Effect framework

The [framework design](./docs/framework/README.md) records the target architecture
and existing foundations. The [roadmap](./docs/framework/roadmap.md) tracks the
implementation and acceptance criteria.

## Packages

- [`@shivaedev/effect-service`](./packages/effect-service): Declared service
  dependencies with native Effect Layers and caller-owned scopes.
- [`@shivaedev/effect-changes`](./packages/effect-changes): Commit-bound change
  channels that publish recorded changes only after their transaction commits.
- [`@shivaedev/effect-changes-prisma`](./packages/effect-changes-prisma):
  Commit-bound changes recorded from Prisma Classic writes, with a test-time
  coverage check.
- [`@shivaedev/effect-sql`](./packages/effect-sql): Simple schema-derived
  repositories over native Effect SQL, and after-commit invalidation.
- [`@shivaedev/effect-contract`](./packages/effect-contract): Query and command
  declarations over native Effect RPC with typed rejections and reactivity keys.
- [`@shivaedev/effect-form`](./packages/effect-form): Schema-based forms and
  editable drafts, with optional React bindings.
- [`@shivaedev/effect-react`](./packages/effect-react): Query state and action
  dispatch hooks for native Effect atoms.
- [`@shivaedev/effect-prisma`](./packages/effect-prisma): Effect-native
  PostgreSQL queries and transactions for Prisma Next.
- [`@shivaedev/effect-test`](./packages/effect-test): Generic Effect Vitest
  runner with worker-scoped Layers and TestClock.
- [`@shivaedev/effect-trpc`](./packages/effect-trpc): Effect-native tRPC
  procedures and testing.
- [`@shivaedev/platform`](./packages/platform): Opinionated application test
  setup combining the shared Prisma and tRPC integrations.
- [`@shivaedev/quality`](./packages/quality): Repository quality gate with typed
  rules, a shrink-only baseline and a registry of reasoned exceptions.
- [`@shivaedev/heavy-lock`](./packages/heavy-lock): Machine-wide lock that runs
  heavy commands one at a time across repositories.
- [`@shivaedev/work-board`](./packages/work-board): A local server that shows a
  folder of markdown files as a live page, updated in place when a file changes.

## Development

Requirements:

- Node.js 24
- pnpm 11

```sh
corepack enable
pnpm install
pnpm ready
```

### Heavy runs

`build`, `typecheck`, `typecheck:compat`, `test` and `test:package`, and so
every step of `ready`, queue on a machine-wide lock shared with other
repositories; a waiting run names the holder, and CI skips the lock. Run the
scripts directly: they take the lock themselves, so do not wrap them in a lock
by hand. Run other heavy commands, such as a focused PostgreSQL suite, through
`pnpm heavy <command>`. The scripts run
[`@shivaedev/heavy-lock`](./packages/heavy-lock) from source, so they work
before anything is built; its README describes the protocol.
