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
  Commit-bound changes recorded from Prisma Classic writes on PostgreSQL only,
  with a test-time coverage check.
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
- [`@shivaedev/test-story`](./packages/test-story): Tests that read like
  stories over the real engine: one Effect story kit per engine with its own
  `it` that names every test after the engine's genre, traits per feature, and a
  failure that prints the story, where it stopped and the engine's state.
- [`@shivaedev/platform`](./packages/platform): Opinionated application test
  setup combining the shared Prisma and tRPC integrations.
- [`@shivaedev/quality`](./packages/quality): Repository quality gate with typed
  rules, a baseline of existing debt, a registry of reasoned exceptions and shared
  tsconfig presets.
- [`@shivaedev/types`](./packages/types): Type-only helpers shared by the
  packages, such as `Bivariant`.
- [`@shivaedev/heavy-lock`](./packages/heavy-lock): Machine-wide lock that runs
  heavy commands one at a time across repositories.
- [`@shivaedev/local-postgres`](./packages/local-postgres): Shared local PostgreSQL
  service preparation that preserves existing databases and data.
- [`@shivaedev/skills`](./packages/skills): Shared agent skills that a repository
  selects in `package.json`, syncs into `.agents/skills` and checks in CI.
- [`@shivaedev/work-board`](./packages/work-board): A local server that shows a
  folder of markdown files as a live page, updated in place when a file changes.

No package has a root entry or a module that re-exports another. Each package exports its source modules through one `"./*.ts"` pattern, with `"./internal/*": null` keeping a package's `internal/` folder private, so you import the module that defines what you need, such as `import { transact } from "@shivaedev/effect-sql/transact.ts"`, and a bundler sees only what you use.

## Development

Requirements:

- Node.js 26.10.0 (the development runtime; published packages retain their Node 24 minimum)
- pnpm 12.8.1
- Docker, or PostgreSQL client tools (`psql`) when reusing a native local service

The package Node requirement is `>=24`, so deployment hosts such as Vercel can use Node 24. Local development and CI use the pinned Node 26.10.0 runtime.

```sh
corepack enable
./script/update
pnpm ready
```

`./script/update` runs from any working directory and calls `pnpm run setup`, which installs frozen dependencies, installs the pre-commit hook with `quality hooks install`, and prepares the database. Installation runs no build, lint, typecheck, or test gates. `pnpm ready` is the explicit handoff gate. Shared service management comes from `@shivaedev/local-postgres`; the setup script owns the workspace database names and schemas. This package workspace has no application server port. Docker client fallback and service startup refuse remote Docker contexts; use a local daemon or a local service with `psql`.

Local setup starts or reuses one PostgreSQL service on `127.0.0.1:55432`, using `postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873`. A new service stores data in the named `development-postgres` volume. Setup never stops or removes an existing service or volume.

`DATABASE_URL` defaults to `postgresql://postgres:postgres@127.0.0.1:55432/platform_dev`. `TEST_DATABASE_URL` supplies the connection settings for tests, with a base name of `platform_test`; each package receives its own suffixed database. Shell settings take precedence over `.env.local`.

| Test variable | Database |
| --- | --- |
| `PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL` | `platform_test_effect_prisma` |
| `PLATFORM_EFFECT_SQL_TEST_DATABASE_URL` | `platform_test_effect_sql` |
| `PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL` | `platform_test_effect_pg_boss` |
| `PLATFORM_EFFECT_CHANGES_PRISMA_TEST_DATABASE_URL` | `platform_test_effect_changes_prisma` |

`pnpm db:setup` creates missing development and package-specific test databases, then initializes the integration and auth schemas in the Prisma test database without dropping tables. SQL, pg-boss and changes-prisma tests prepare their own objects in their separate databases. Local preparation and `pnpm test` validate each database name and refuse remote hosts, development databases, shared test targets or connection overrides. Existing databases and data are preserved.

`pnpm test` and CI select the package variables through the shared PostgreSQL test-environment module in `script/lib`, using these defaults. Each variable can override its own connection settings while retaining its package-specific database name. Individual package test commands accept those variables directly; use the corresponding local URL above to run PostgreSQL coverage. Prisma generation runs explicitly in the package build/typecheck/test paths.

### Heavy runs

`build`, `typecheck`, `test` and `test:package`, and so every step of `ready`,
queue on a machine-wide lock shared with other repositories; a waiting run names
the holder, and CI skips the lock. Run the scripts directly: they take the lock
themselves, so do not wrap them in a lock by hand. Run other heavy commands,
such as a focused PostgreSQL suite, through `pnpm heavy <command>`. The scripts
run [`@shivaedev/heavy-lock`](./packages/heavy-lock) from source, so they work
before anything is built; its README describes the protocol.

### Packed consumers

`pnpm test:package` packs every publishable package once, validates its manifest
and source maps, then installs clean consumers with its workspace dependency
tarballs. Consumers use the catalog Effect versions, reject duplicate Effect
installations, and import every exported module with both supported TypeScript
versions. The same gate runs executable bins against real input.
Consumers for packages with executable bins omit the repository's Effect
overrides, so exact peers must keep their Effect stack aligned. Unrelated
dependency pins and installation trust policies stay in force. Packed
executables using the Node platform must declare its shared layer as an exact
peer at the same version. The gate removes that peer from a temporary copy of
the Heavy Lock tarball and verifies that archive validation rejects it.
Every `#` import in a packed module must name an `imports` entry whose
targets are all packed; the gate also removes one such target from a copy of
the Heavy Lock tarball and verifies that archive validation rejects it. Every
source module the `./*.ts` export matches must ship its built `.js` and `.d.ts`;
the gate removes one built module from a copy of the Heavy Lock tarball and
verifies that archive validation rejects that too. A module under a `null`
export such as `./internal/*` is left out, and the consumer verifies that
importing one fails. Each
consumer lib-checks the declarations of Platform's packages, third-party
declarations aside, and rejects an entry that exports a value or type as `any`.

Consumer type-error fixtures live in `script/package-check/fixtures`. Declarative
cases alongside the runner describe optional-peer consumers, browser entry
constraints and executable input; package file lists come from manifests.
The publish workflow runs this gate in a read-only prerequisite job.
