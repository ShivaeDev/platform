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
- [`@shivaedev/build`](./packages/build): An application's build setup: the generator that writes each defined module's wire and browser contract from its operations' `run` types.
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
- [`@shivaedev/deploy`](./packages/deploy): Composable Railway web and worker services with overridable migration, proxy and draining defaults.
- [`@shivaedev/releases`](./packages/releases): Explicit changesets and reproducible workspace releases.
- [`@shivaedev/quality`](./packages/quality): Opinionated repository quality policy with shared tooling and minimal setup; counted existing debt keeps adoption practical without weakening the checks.
- [`@shivaedev/types`](./packages/types): Type-only helpers shared by the packages, such as `Bivariant`.
- [`@shivaedev/heavy-lock`](./packages/heavy-lock): Shared advisory lock that runs cooperating heavy commands one at a time across repositories.
- [`@shivaedev/local-postgres`](./packages/local-postgres): Shared local PostgreSQL service preparation that preserves existing databases and data.
- [`@shivaedev/vitest-rerun`](./packages/vitest-rerun): Reruns failed Vitest tests in a fresh process and lists the tests that only passed on a rerun in `flaky-tests.json` beside the JUnit report.
- [`@shivaedev/skills`](./packages/skills): ShivaeDev's shared agent skills, distributed as committed repository files with simple updates and drift checks.

Work Board, Work Fleet and the Work Board plugin are applications built on these packages, maintained in [ShivaeDev/work-apps](https://github.com/ShivaeDev/work-apps). This repository's plugin marketplace still installs the plugin with `/plugin install workboard --marketplace ShivaeDev/platform`; it builds the plugin from that repository.

No package has a root entry or a module that re-exports another. Published packages export their source modules through one `"./*.ts"` pattern, so a module's import path is its path inside the package's source folder. You import the module that defines what you need, such as `import { transact } from "@shivaedev/sql/transact.ts"`, and a bundler sees only what you use.

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

`./script/update` runs from any working directory and calls `pnpm run setup`, which installs frozen dependencies, installs the pre-commit hook with `quality hooks install`, and prepares the database. On a local checkout the hook runs only Biome's lint and format checks on the staged content of the staged files, through Quality's `preCommit: "staged"` setting; files under `examples/starter`, which has its own Quality config, are left to CI. In a Claude Code cloud session, where `CLAUDE_CODE_REMOTE` is `true`, the hook runs the checks of `pnpm lint` and `pnpm typecheck` on every commit, through Quality's lint gate, the conventional `typecheck` script and Platform's `quality:commit` script. CI is the full gate on every pull request; run `pnpm ready` for its static checks locally. Setup runs none of the workspace build, lint, typecheck or test gates. The root `pnpm ready` is the fast static gate: Biome lint and format checks, repository rules, the changelog check and typechecking. CI runs the full test suite, builds and package archive checks across its shards; `pnpm test`, `pnpm test:orchestration`, `pnpm build` and `pnpm test:package` remain available separately. Shared service management comes from `@shivaedev/local-postgres`; the setup script owns the workspace database names and schemas. Setup starts no application server; the starter uses ports 3000 and 5173. Docker client fallback and service startup refuse remote Docker contexts; use a local daemon or a local service with `psql`.

In a Claude Code cloud session, `.claude/hooks/session-start.sh` makes the session ready before it starts: it installs the Node version of `.node-version` and the PostgreSQL release of the pinned local image from the PGDG apt repository, serves PostgreSQL on the port that local setup expects without TLS, like the container does, runs `./script/update` when its inputs changed, and exposes Node on the session's PATH. A second run at the same time waits for the first. The repository states every version, so the cloud environment needs no update when one moves. A cloud sandbox has no IPv6 loopback, runs as root and has no Docker daemon, so the specs that need those fail or skip there.

Local setup starts or reuses one PostgreSQL service on `127.0.0.1:55432`. Setup never stops or removes an existing service or volume.

`DATABASE_URL` defaults to `postgresql://postgres:postgres@127.0.0.1:55432/platform_dev`. `TEST_DATABASE_URL` supplies the connection settings for tests, with a base name of `platform_test`; each package receives its own suffixed database. Shell settings take precedence over `.env.local`.

| Test variable                         | Database                 |
| ------------------------------------- | ------------------------ |
| `PLATFORM_SQL_TEST_DATABASE_URL`      | `platform_test_sql`      |
| `PLATFORM_JOBS_TEST_DATABASE_URL`     | `platform_test_jobs`     |
| `PLATFORM_TEST_SQL_TEST_DATABASE_URL` | `platform_test_test_sql` |

`pnpm db:setup` creates missing development and package-specific test databases without dropping anything. Each package's tests prepare their own objects in their separate database. Local preparation and `pnpm test` validate each database name and refuse remote hosts, development databases, shared test targets or connection overrides. Existing databases and data are preserved.

`pnpm test` and CI select the package variables through the shared PostgreSQL test-environment module in `script/lib`, using these defaults. Each variable can override its own connection settings while retaining its package-specific database name. Individual package test commands accept those variables directly; use the corresponding local URL above to run PostgreSQL coverage.

Run focused tests with `pnpm --filter @shivaedev/<package> test <paths>`. The shared pnpm configuration resolves workspace sources, so these commands work before any build. The `quality` and `shivaedev-skills` bins run their sources too: in the workspace each `bin` points at a `bin/source.ts` launcher, and `publishConfig.bin` packs the published bin at `dist/cli.js`. Add `--project slow` for `*.slow.test.ts` files, which the default run skips. For example, after local setup:

```sh
PLATFORM_SQL_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/platform_test_sql pnpm --filter @shivaedev/sql test src/repositoryCrud.spec.ts
```

CI runs each workspace test shard through [`@shivaedev/vitest-rerun`](./packages/vitest-rerun) with Vitest retries disabled. On pull requests and in the merge queue, the failed tests run once more in a fresh Vitest process; the shard fails if that rerun fails, and recovered tests appear in the job summary and in `.ci/flaky-tests.json`, where flaky-test tracking picks them up. The final reports in `.ci` keep the whole shard, and the raw report of each attempt stays in the timing artifact. A recovered test does not fail `verify`: the shard timings it merges after a green merge-queue run leave out a recovered file's failed first attempt.

Packed starter is the single pre-merge generated-app check, required on every pull request and in the merge queue. It runs `check:published --archives .ci/packages` with the packed create-app command and installs each pinned package as the next release would publish it; the packed consumer check of the create-app bin chooses the same way. A pinned package comes from the PR’s archive when the release planner, run on the checked commit's pending changesets, releases it: a changeset names it, it depends on a package the plan releases, or its packed dependencies, optional dependencies or peers differ from its published manifest. It also comes from the archive when its version is not on npm. Every other pinned package comes from npm, so a package the next release leaves alone still exposes published type and peer mismatches that workspace sources can hide. The check logs each pinned package's source and the changeset, released dependency or declaration change behind it.

Pending changesets choose archives only while the packed create-app version is already on npm. A release PR and its merge group carry a create-app version npm does not have yet, and the changesets still pending there wait for a later release, so that commit takes archives only for unreleased versions and declaration changes. An approved release therefore cannot publish a create-app that relies on a changeset the release leaves out. A pull request queued behind a release, or run after a release merged and before publishing put its packages on npm, is in the same position: its own changeset selects nothing, so its packed checks fail if its starter change needs that changeset, and pass when run again after publishing. The check does not prove that the create-app on npm today works, or that the published versions of planned packages work with the current starter. There is no post-publish starter workflow.

Main push runs skip the shard planner, the package build, the test shards, the packed consumer shards and the packed starter variants, which the merge queue already ran on the same commit, and keep the other CI jobs. The shard planner reads test and consumer timing snapshots from green merge-queue runs and logs the selected run IDs. Each test shard receives files longest first so that the shards' predicted wall times stay even: a file of a single-worker project such as `:heavy` runs alone after the others and counts its recorded duration plus its start-up, and any other file counts its duration divided by the parallelism its project's workers reach on the runner.

Each shard's `coverage-tests-<shard>` artifact holds the LCOV report, `measured-commits.txt`, the final JUnit report, `flaky-tests.json` when a test recovered, and `job.txt` with the shard job's check run ID. Coverage for a commit on main comes from its `merge_group` run; the first line of `measured-commits.txt` is that merge commit, and the second is its first parent.

[Work Fleet](https://github.com/ShivaeDev/work-apps/tree/main/packages/work-fleet) and the Work Board run from a checkout of their own repository, with its own dependency pins, so this repository does not install them. Start a Fleet for this Board from this repository's root with that checkout's `script/work-fleet`, such as `script/work-fleet up .work`, with one foreground supervisor per Board directory.

### Heavy runs

`build`, `typecheck`, `test` and `test:package` queue on a machine-wide lock shared with other repositories; a waiting run names the holder, and CI skips the lock. The root `ready` takes this lock only during typechecking. Run the scripts directly: they take the lock themselves, so do not wrap them in a lock by hand. Run other heavy commands, such as a focused PostgreSQL suite, through `pnpm heavy <command>`. The scripts run [`@shivaedev/heavy-lock`](./packages/heavy-lock) from source, so they work before anything is built; its README describes the protocol.

### Packed consumers

`pnpm test:package` packs every publishable package once, validates its manifest, source maps and packed files, then installs clean consumers from the tarballs. Consumers use the catalog Effect versions, reject duplicate Effect installations, import every exported module with both supported TypeScript versions, lib-check Platform's declarations, reject `any` exports and run executable bins against real input. Executable packages on the Node platform declare its shared layer as an exact peer, because their consumers omit the repository's Effect overrides.

Consumer type-error fixtures live in `script/package-check/fixtures`; declarative cases beside the runner describe optional-peer consumers, browser entry constraints and executable input. The publish workflow runs this gate in a read-only prerequisite job.
