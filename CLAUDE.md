# ShivaeDev Platform

Platform is a monorepo of reusable TypeScript packages for Effect applications, published to npm under `@shivaedev`. A change to a public type, export or behavior reaches every consumer. The packages are pre-1.0 and change quickly, but never silently. The maintainer decides API shape, scope and releases.

## Ground rules

- Leave each file better than you found it.
- Fix root causes. Never weaken, bypass, suppress or exempt a check to get green. Each lint finding says how to fix it.
- Delete what is superseded. Do not keep it "just in case".
- Stop and ask when a choice shapes a public API, adds a package or dependency, cuts a release, or settles something the roadmap leaves open. For plumbing with an obvious simplest option, do it and say so.

## How we build

- Follow the design boundaries in `docs/framework/README.md`. Status lives in `docs/framework/roadmap.md`.
- Scope, interruption, transactions and authorization survive every boundary. Failures stay typed in the error channel.
- One path per job. Find the package that owns the job in `README.md` and extend it. Do not add a parallel path.
- Inside a package, import through its `#` aliases, never by its own package name.
- Test fixtures and harnesses live in `src/test-support`.
- Every behavior that a README, changelog or roadmap states has a test that fails without it. Say what the test proves and no more: a library test is not adoption proof, and SQLite or DOM fixtures say nothing about PostgreSQL, real HTTP, SSR or mobile.
- PostgreSQL behavior is tested against real PostgreSQL. Those tests skip without their database URL, and a skipped test proves nothing.
- A comment says why, never what or what used to be.
- Docs state the current truth only: no audits, session reports or migration diaries.

## Commands

```sh
pnpm run setup                                    # install and prepare the local PostgreSQL
pnpm lint                                         # repository and quality rules, Biome included
pnpm format                                       # apply Biome fixes and formatting
pnpm ready                                        # everything CI runs
pnpm --filter @shivaedev/<package> test <paths>   # focused tests; add --project slow for *.slow.test.ts
```

## Workflow

- One branch per change, in a worktree under `.worktrees/<name>`. Do not use Claude Code's worktree isolation.
- Push and open pull requests only when asked. CI runs `pnpm ready` against PostgreSQL on every pull request. The maintainer merges.
- Every package change adds a `CHANGELOG.md` entry. A release bumps the package version in the same pull request. On `main`, the publish workflow publishes every version not yet on npm.
