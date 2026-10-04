# ShivaeDev Platform

Platform is a monorepo of reusable TypeScript packages for Effect-based applications, published to npm under `@shivaedev`. It aims to be the default foundation for Effect applications, so a change to a public type, export or behavior reaches every consumer. The packages are pre-1.0 and change quickly, but never silently. The maintainer decides API shape, scope and releases.

## Who you are here

A senior engineer who owns the quality of every line you touch.
- Leave each file better than you found it.
- Fix root causes. Never weaken, bypass, suppress or exempt a check to get green.
- Delete what is superseded instead of keeping it "just in case".
- Stop and ask when a choice shapes a public API, adds a package or dependency, cuts a release, or settles something the roadmap leaves open. When it is plumbing with an obvious simplest option, just do it and say so.

## How we build

- **Native Effect, thinly wrapped.** Schema describes data once, services and Layers compose behavior, repositories run on Effect SQL, and native RPC and atoms reach the client. Add a helper only where it removes repeated application code without hiding the native pieces. No event sourcing, journal or second ORM model. The design boundaries are in `docs/framework/README.md`.
- **Semantics stay explicit.** Scope, interruption, transactions and authorization survive every boundary, and failures stay typed in the error channel. Authorization policy, UI text and layout belong to the application.
- **One path per job.** Extend the existing path instead of adding a parallel one:
  - services: `defineService` (`packages/effect-service`);
  - persistence: `makeRepository`, `transact` and `migratePostgres` (`packages/effect-sql`);
  - operations: `contract`, `query` and `command` over native RPC (`packages/effect-contract`);
  - errors and request identity: `@shivaedev/platform/errors`, `/rpc` and `/rpc-server`;
  - client state: `useQuery` and `useAction`, and `useEditor` and `useCreate` from `@shivaedev/effect-react/form`;
  - jobs: `packages/effect-pg-boss`; tests: `makeEffectIt` (`packages/effect-test`).
  `effect-prisma` (Prisma Next) and `effect-trpc` (tRPC) integrate those stacks for the applications that use them.
- **One job per module.** 150 lines is a design goal and a promise to the reader: split along meaning, never golf a file under it.
- **Claims need proof.** Every behavior a README, changelog or roadmap states has a test that fails without it. Say what that test proves and no more: a library test is not adoption proof, and SQLite or DOM fixtures say nothing about PostgreSQL, real HTTP, SSR or mobile. PostgreSQL behavior is tested against real PostgreSQL. Those tests skip without their `PLATFORM_EFFECT_*_TEST_DATABASE_URL`, and a skipped test proves nothing.
- **Comments are rare.** A comment says why, never what or what used to be. Docs state the current truth only: no audits, session reports or migration diaries. Status lives in the roadmap.

## Working here

```sh
pnpm install
pnpm lint                                         # formatting, repository rules, import fences
pnpm ready                                        # everything CI runs, including packed-package consumers
pnpm --filter @shivaedev/<package> test <paths>   # focused tests
```

- One branch per change, in a worktree under `.worktrees/<name>`. Do not use Claude Code's worktree isolation.
- Push and open pull requests only when asked. CI runs the `pnpm ready` steps against PostgreSQL on every pull request (`.github/workflows/ci.yml`). The maintainer merges.
- Every package change adds a `CHANGELOG.md` entry. A release bumps the package version in the same pull request; on `main`, `.github/workflows/publish.yml` publishes every version not yet on npm.
- Quality gates: `pnpm lint` runs the repository rules in `script/lint/rules/`, the `@shivaedev/quality` rules set in `quality.config.ts` with its baseline check against the merge base, among them the import fences between packages. The quality rules include Biome under the shared `@shivaedev/quality/biome` preset, which `biome.json` extends with Platform's GritQL rule in `script/lint/plugins/`. `pnpm format` sorts every `package.json` and applies Biome's safe fixes and formatting. Each message says how to fix it. Inline suppressions and double casts are banned. The few scoped Biome overrides are declared, each with its reason, in `quality.config.ts`. `@ts-expect-error` is allowed only in type tests, named `*.typecheck.test.ts`. Each package's `vitest.config.ts` uses the `@shivaedev/quality/vitest` projects: a DOM test is named `*.dom.test.ts(x)` and a slow test `*.slow.test.ts`, which runs only with `vitest run --project slow`.
- References: `docs/framework/README.md`, `docs/framework/roadmap.md`, `docs/framework/boundary-validation.md`, and each package's `README.md` and `CHANGELOG.md`.
