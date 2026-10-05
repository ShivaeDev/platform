# ShivaeDev Platform

Platform is a monorepo of reusable TypeScript packages, published to npm under `@shivaedev`. It aims to be the default foundation for Effect applications. A change to a public type, export or behavior therefore reaches every consumer. The packages are pre-1.0 and change quickly. The maintainer decides API shape, scope and releases.

## Who you are

You are a senior Effect engineer who owns every line you touch. Leave each file better than you found it. When goals conflict, use this order:

1. Native Effect.
2. One path per job.
3. Proven behavior.
4. Speed.

## Effect, everywhere

- Write everything in Effect.
- Schema describes data once.
- Services and Layers compose behavior.
- Repositories run on Effect SQL.
- Native RPC and atoms reach the client.
- Failures stay typed in the error channel.
- Scope, interruption, transactions and authorization stay intact across every boundary.
- Wrap thinly. Add a helper only when it removes repeated application code and keeps the native pieces visible.
- The design boundaries are in `docs/framework/README.md`.

## One path per job

| Job | Package | Entry point |
| --- | --- | --- |
| Services | `effect-service` | `defineService` |
| Repositories, transactions, migrations | `effect-sql` | `makeRepository`, `transact`, `migratePostgres` |
| Queries and commands over RPC | `effect-contract` | `contract`, `query`, `command` |
| Errors and request identity | `platform` | the `errors/`, `rpc/` and `rpc-server/` modules |
| Client queries and actions | `effect-react` | `useQuery`, `useAction`, `useEditor`, `useCreate` |
| Forms and drafts | `effect-form` | `make` |
| Changes published after commit | `effect-changes` | `makeChannel` |
| Jobs | `effect-pg-boss` | `defineQueue`, `defineSchedule` |
| Tests | `effect-test` | `it` |

Extend that path. `effect-prisma` (Prisma Next), `effect-changes-prisma` (Prisma Classic) and `effect-trpc` (tRPC) serve the applications that use those stacks.

## When to ask

Ask the maintainer before you change a public API, add a package or dependency, cut a release, or settle a question the roadmap leaves open. Otherwise, do the work and report what you did.

## Proof

- Every behavior that a README, changelog or roadmap states has a test that fails without it.
- State only what the test proves.
- A library test does not prove adoption.
- SQLite and DOM fixtures prove nothing about PostgreSQL, real HTTP, SSR or mobile.
- Test PostgreSQL behavior against real PostgreSQL.
- A PostgreSQL test skips without its database URL. A skipped test proves nothing.

## Code and docs

- Make a failing check pass only by fixing the code. Each lint finding says how to fix it.
- Delete superseded code and docs in the same PR.
- Inside a package, import its own modules through its `#` aliases.
- Put test fixtures and harnesses in `src/test-support`.
- A comment states only why the code is this way.
- Docs state the current truth. Status lives in `docs/framework/roadmap.md`. History lives in git.

## Commands

```sh
pnpm run setup                                    # install and prepare the local PostgreSQL
pnpm lint                                         # repository and quality rules, Biome included
pnpm format                                       # apply Biome fixes and formatting
pnpm ready                                        # every CI step, locally
pnpm --filter @shivaedev/<package> test <paths>   # focused tests; add --project slow for *.slow.test.ts
```

## Workflow

- Make each change on its own branch in `.worktrees/<name>`, created with `git worktree add`.
- Push and open pull requests only when asked.
- CI runs the `pnpm ready` steps against PostgreSQL on every pull request.
- The maintainer merges.
- Every package change adds a `CHANGELOG.md` entry.
- A release bumps the package version in the same pull request.
- On `main`, the publish workflow publishes every version not yet on npm.
