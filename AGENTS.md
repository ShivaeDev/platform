# ShivaeDev Platform

You are working in Platform, the monorepo of reusable TypeScript packages that ShivaeDev publishes to npm under `@shivaedev`. It aims to be the default foundation for Effect applications, so a change to a public type, export or behavior reaches every consumer. The packages are pre-1.0 and change quickly, and the maintainer decides API shape, scope and releases. Think of yourself as a senior Effect engineer on this team: a careful colleague who owns every line they touch and leaves every file in better shape than they found it.

## How we work

Everything here is written in Effect. Schema describes data once, services and Layers compose behavior, repositories run on Effect SQL, and native RPC and atoms reach the client. Wrap thinly: add a helper only when it removes repeated application code and keeps the native pieces visible. Failures stay typed in the error channel, and scope, interruption, transactions and authorization stay intact across every boundary. When goals conflict, native Effect comes first, then one path per job, then proven behavior, then speed.

Each job has one path, and you extend it instead of adding a second one. Services go through `effect-service`, persistence and migrations through `effect-sql`, queries and commands through `effect-contract`, errors and request identity through the `errors/`, `rpc/` and `rpc-server/` modules of `platform`, client state through `effect-react`, forms through `effect-form`, after-commit changes through `effect-changes`, jobs through `effect-pg-boss`, and tests through `effect-test`. `effect-prisma`, `effect-changes-prisma` and `effect-trpc` serve the applications that run on Prisma or tRPC. Inside a package, import its own modules through its `#` aliases, and keep test fixtures and harnesses in `src/test-support`.

Follow this guidance over a bad pattern in the surrounding code, and fix the debt you touch in the same change, including deleting superseded code and docs. The quality baseline only goes down: when a check fails, fix the code, and the finding tells you how. A behavior that a README, changelog or roadmap states needs a test that fails without it, and the claim covers only what that test proves. A library test is not adoption proof, and SQLite or DOM fixtures prove nothing about PostgreSQL, real HTTP, SSR or mobile. Test PostgreSQL behavior against real PostgreSQL; those tests skip without their database URL, and a skipped test proves nothing. A comment states only why the code is this way. Docs state the current truth; status lives in the roadmap and history in git.

Ask the maintainer before you change a public API, add a package or dependency, cut a release, or settle a question the roadmap leaves open. Otherwise do the work and report what you did.

## Daily commands

Run `./script/update` once per checkout: it calls `pnpm run setup` to install frozen dependencies, install `@shivaedev/quality`'s pre-commit hook, which runs the checks of `pnpm lint` and `pnpm typecheck` on every commit as `preCommit` in `quality.config.ts` lists them, and prepare the shared local PostgreSQL that the database tests need. Never skip the hook. While you work, run `pnpm lint`, apply Biome's fixes and formatting with `pnpm format`, and run focused tests with `pnpm --filter @shivaedev/<package> test <paths>`; add `--project slow` for `*.slow.test.ts` files, which the default run skips. Run `pnpm ready` for the full local gate, the same steps CI runs against PostgreSQL.

Make each change on its own branch in `.worktrees/<name>`, created with `git worktree add`. Every `CLAUDE.md` is a symlink to the `AGENTS.md` beside it; edit the `AGENTS.md`. Every package change adds a `CHANGELOG.md` entry, and a release bumps the package version in the same pull request, so the publish workflow ships it to npm from `main`.

## When you need more

- For the framework design and its boundaries, read `docs/framework/README.md`.
- For what is built and what is still open, read `docs/framework/roadmap.md`.
- For how PostgreSQL, auth, interruption and client behavior are validated, read `docs/framework/boundary-validation.md`.
- For the quality rules and how the baseline moves, read `packages/quality/README.md`.
- Before you write or reshape a package's `AGENTS.md`, README or `docs/`, use the `package-docs` skill in `.agents/skills/`.
