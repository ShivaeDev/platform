# ShivaeDev Platform

Reusable TypeScript packages for Effect-based applications. The packages share native Effect data, service and lifecycle conventions. Published packages may change quickly before 1.0.

## Native Effect framework

The [framework design](./docs/framework/README.md) explains the application path and its boundaries.

Every package has a README for people and agents using it and a short `AGENTS.md` for agents changing it. Published packages ship their README, and `docs/` where they have one, to npm; agent instructions stay in the repository.

## Packages

- [`@shivaedev/service`](./packages/service): Declared service dependencies and private initialization, kept as native Effect services with native Layers and caller-owned scopes.
- [`@shivaedev/changes`](./packages/changes): Commit-bound change channels that publish recorded changes only after their transaction commits.
- [`@shivaedev/sql`](./packages/sql): Rows described once with an Effect model for writes, filters and decoded reads, through small repositories over native Effect SQL, transactions and migrations.
- [`@shivaedev/contract`](./packages/contract): Query, command and stream declarations with typed rejections and refresh dependencies, compiled to native Effect RPC and bound to native AtomRpc queries.
- [`@shivaedev/form`](./packages/form): Schema-based forms that keep input values, decoded submissions and fresh server data together, with optional React bindings.
- [`@shivaedev/react`](./packages/react): Readable state for native Effect atom queries and actions, editors that join a record to its form, and session-owned client state.
- [`@shivaedev/jobs`](./packages/jobs): Schema-defined PostgreSQL jobs and scoped pg-boss workers on the application's Effect services.
- [`@shivaedev/test`](./packages/test): One Effect Vitest runner for tests and reusable fixtures, with the application's services and a controlled clock.
- [`@shivaedev/test-sql`](./packages/test-sql): PostgreSQL test fixtures prepared once, per-test rollback and isolated databases for real commits.
- [`@shivaedev/test-story`](./packages/test-story): Tests that read like short stories and run the real engine: a spec names its setup in domain words and acts through the application's verbs.
- [`@shivaedev/platform`](./packages/platform): The framework in one dependency: a code-free shell that depends on every runtime piece, for applications that import each piece by its own name.
- [`@shivaedev/errors`](./packages/errors): The shared failure taxonomy, typed field rejections and redaction of sensitive values, safe in the browser.
- [`@shivaedev/http`](./packages/http): Bounded bodies, typed status failures with retry hints, and paginated requests for Effect's HTTP client and server.
- [`@shivaedev/webhooks`](./packages/webhooks): Signed webhook deliveries verified, deduplicated and recorded with their queued work in one transaction.
- [`@shivaedev/identity`](./packages/identity): Request identity, session resolution, transport trust and permission checks, with an optional Better Auth adapter.
- [`@shivaedev/server`](./packages/server): The application host: migrations, native RPC and static assets over Node HTTP, session checks, redacted diagnostics, trace export, development mode and a runtime for Promise callers.
- [`@shivaedev/access`](./packages/access): Browser-safe role declarations and permission checks.
- [`@shivaedev/admin`](./packages/admin): Explicit admin page contracts and a protected native Effect RPC registry.
- [`@shivaedev/github`](./packages/github): Typed GitHub REST requests, conditional reads and resource budgets.
- [`@shivaedev/pr-watch`](./packages/pr-watch): One REST watcher for pull request transitions across a repository.
- [`@shivaedev/create-app`](./packages/create-app): Creates and installs an application from the maintained starter and merges later starter releases into it.
- [`@shivaedev/releases`](./packages/releases): Explicit changesets and reproducible workspace releases.
- [`@shivaedev/quality`](./packages/quality): Opinionated repository quality policy with shared tooling and minimal setup; counted existing debt keeps adoption practical without weakening the checks.
- [`@shivaedev/types`](./packages/types): Type-only helpers shared by the packages, such as `Bivariant`.
- [`@shivaedev/heavy-lock`](./packages/heavy-lock): Shared advisory lock that runs cooperating heavy commands one at a time across repositories.
- [`@shivaedev/local-postgres`](./packages/local-postgres): Shared local PostgreSQL service preparation that preserves existing databases and data.
- [`@shivaedev/vitest-rerun`](./packages/vitest-rerun): Reruns failed Vitest tests in a fresh process and lists the tests that only passed on a rerun in `flaky-tests.json` beside the JUnit report.
- [`@shivaedev/skills`](./packages/skills): ShivaeDev's shared agent skills, distributed as committed repository files with simple updates and drift checks.
- [`@shivaedev/work-board`](./packages/work-board): A local workspace for reading agents' Markdown plans, results and questions and giving reviewed direction to an existing agent session.
- [`@shivaedev/work-fleet`](./packages/work-fleet): Launches approved Work Board items, schedules workers and keeps execution receipts in PostgreSQL.
- [Work Board plugin](./packages/work-board-plugin): The Work Board inside Claude Code, installed with `/plugin install workboard --marketplace ShivaeDev/platform` from this repository's plugin marketplace.

No package has a root entry or a module that re-exports another. Published packages export their source modules through one `"./*.ts"` pattern, so a module's import path is its path inside the package's source folder, and a `null` entry such as `"./internal/*": null` keeps an internal folder or browser bundle sources private. You import the module that defines what you need, such as `import { transact } from "@shivaedev/sql/transact.ts"`, and a bundler sees only what you use.

## Development

For a new application, follow the [framework quickstart](./docs/framework/quickstart.md). An application depends on `@shivaedev/platform` and takes `@shivaedev/test-story` and `@shivaedev/quality` for development, and its `pnpm-workspace.yaml` hoists `@shivaedev/*` so the pieces platform brings resolve; the [platform README](./packages/platform/README.md) explains the setup. This workspace hoists the scope too, because `examples/starter` resolves its pieces from the root.

Requirements:
- Node.js at the version in `.node-version` for development and CI; published packages need Node 24 or newer, so deployment hosts such as Vercel can use Node 24
- pnpm through Corepack, at the version in `package.json`'s `packageManager`
- Docker, or PostgreSQL client tools (`psql`) when reusing a native local service

```sh
corepack enable
./script/update
pnpm ready
```

`./script/update` runs from any working directory and calls `pnpm run setup`, which installs frozen dependencies, installs the pre-commit hook with `quality hooks install`, and prepares the database. The hook runs the checks of `pnpm lint` and `pnpm typecheck` on every commit, through Quality's lint gate, the conventional `typecheck` script and Platform's `quality:commit` script. Installation runs no build, lint, typecheck, or test gates. The root `pnpm ready` is the fast static gate: Biome lint and format checks, repository rules, the changelog check and typechecking. CI runs the full test suite, builds and package archive checks across its shards; `pnpm test`, `pnpm test:orchestration`, `pnpm build` and `pnpm test:package` remain available separately. Shared service management comes from `@shivaedev/local-postgres`; the setup script owns the workspace database names and schemas. Setup starts no application server; the starter uses ports 3000 and 5173. Docker client fallback and service startup refuse remote Docker contexts; use a local daemon or a local service with `psql`.

Local setup starts or reuses one PostgreSQL service on `127.0.0.1:55432`. Setup never stops or removes an existing service or volume.

`DATABASE_URL` defaults to `postgresql://postgres:postgres@127.0.0.1:55432/platform_dev`. `TEST_DATABASE_URL` supplies the connection settings for tests, with a base name of `platform_test`; each package receives its own suffixed database. Shell settings take precedence over `.env.local`.

| Test variable                         | Database                 |
| ------------------------------------- | ------------------------ |
| `PLATFORM_SQL_TEST_DATABASE_URL`      | `platform_test_sql`      |
| `PLATFORM_JOBS_TEST_DATABASE_URL`     | `platform_test_jobs`     |
| `PLATFORM_TEST_SQL_TEST_DATABASE_URL` | `platform_test_test_sql` |

`pnpm db:setup` creates missing development and package-specific test databases without dropping anything. Each package's tests prepare their own objects in their separate database. Local preparation and `pnpm test` validate each database name and refuse remote hosts, development databases, shared test targets or connection overrides. Existing databases and data are preserved.

`pnpm test` and CI select the package variables through the shared PostgreSQL test-environment module in `script/lib`, using these defaults. Each variable can override its own connection settings while retaining its package-specific database name. Individual package test commands accept those variables directly; use the corresponding local URL above to run PostgreSQL coverage.

Run focused tests with `pnpm --filter @shivaedev/<package> test <paths>`. The shared pnpm configuration resolves workspace sources, so these commands work before any build. Add `--project slow` for `*.slow.test.ts` files, which the default run skips. For example, after local setup:

```sh
PLATFORM_SQL_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/platform_test_sql pnpm --filter @shivaedev/work-fleet test src/engine/approvedBrief.spec.ts
PLATFORM_SQL_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/platform_test_sql pnpm --filter @shivaedev/sql test src/postgres.spec.ts
```

CI runs each workspace test shard through [`@shivaedev/vitest-rerun`](./packages/vitest-rerun) with Vitest retries disabled. On pull requests, pushes and in the merge queue alike, the failed tests run once more in a fresh Vitest process; the shard fails if that rerun fails, and recovered tests appear in the job summary and in `.ci/flaky-tests.json`, where flaky-test tracking picks them up. The final reports in `.ci` keep the whole shard, and the raw report of each attempt stays in the timing artifact. A recovered test does not fail `verify`: the shard timings it merges on `main` leave out a recovered file's failed first attempt.

Each shard's `coverage-tests-<shard>` artifact holds the LCOV report, `measured-commits.txt`, the final JUnit report, `flaky-tests.json` when a test recovered, and `job.txt` with the shard job's check run ID.

`pnpm fleet` runs the [Work Fleet](./packages/work-fleet) CLI from source, such as `pnpm fleet up`, `pnpm fleet status` and `pnpm fleet watch`, with one foreground supervisor per Board directory.

### Heavy runs

`build`, `typecheck`, `test` and `test:package` queue on a machine-wide lock shared with other repositories; a waiting run names the holder, and CI skips the lock. The root `ready` takes this lock only during typechecking. Run the scripts directly: they take the lock themselves, so do not wrap them in a lock by hand. Run other heavy commands, such as a focused PostgreSQL suite, through `pnpm heavy <command>`. The scripts run [`@shivaedev/heavy-lock`](./packages/heavy-lock) from source, so they work before anything is built; its README describes the protocol.

### Packed consumers

`pnpm test:package` packs every publishable package once, validates its manifest, source maps and packed files, then installs clean consumers from the tarballs. Consumers use the catalog Effect versions, reject duplicate Effect installations, import every exported module with both supported TypeScript versions, lib-check Platform's declarations, reject `any` exports and run executable bins against real input. Executable packages on the Node platform declare its shared layer as an exact peer, because their consumers omit the repository's Effect overrides.

Consumer type-error fixtures live in `script/package-check/fixtures`; declarative cases beside the runner describe optional-peer consumers, browser entry constraints and executable input. The publish workflow runs this gate in a read-only prerequisite job.
