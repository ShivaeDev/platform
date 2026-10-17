# @shivaedev/create-app

Start a Platform application without copying repository files or editing workspace dependencies. One command creates the maintained starter, installs its published dependencies and shows the steps to run it.

## From an empty folder to an app

The starter brings PostgreSQL, authenticated RPC and a React notes screen together in a small application you can change. Its source stays in Platform's `examples/starter`, so the generator carries the same app that the framework maintains.

```text
Created my-app.
```

## Create and run

Use Node 24 or newer and pnpm. The package contains a snapshot of the starter made when it is packed. Platform dependencies use exact versions from the starter's `published-versions.json`; its self-contained pnpm catalog pins the remaining dependencies.

```sh
pnpm create @shivaedev/app my-app
```

The folder argument may include a parent path. Its final folder name becomes the package name and must be a lowercase npm name. The destination must be absent or empty, including hidden files. The command runs `pnpm run setup` in the generated app to install dependencies and Quality's pre-commit hook, and reports setup failure with a nonzero exit status. Setup installs the hook only when the app has its own `.git`; it leaves an enclosing repository's hooks alone.

After installation, follow the printed steps:

```sh
cd my-app
pnpm dev
```

The command writes a git-ignored `.env.local` with a fresh authentication secret and local development and test database URLs. Existing files are never overwritten. Database names replace dots and hyphens in the app name with underscores, prefix a name starting with a digit with `app_`, and limit the stem to 58 characters before adding `_dev` and `_test`.

A generated app gets a README titled with its name, its own framework guidance in `AGENTS.md`, and `CLAUDE.md` linked to that guidance. Its `.env.example` uses the same database names as `.env.local`. Template maintenance documentation and the published-version manifest stay in the source repository. Non-secret application files and the installed lockfile use mode `0644`; `.env.local` uses `0600`.

When Git is available and the destination is outside an existing repository, the command initializes a repository before setup and commits the generated files and installed lockfile afterward. The first commit runs Quality's lint and typecheck gates; a failed gate leaves it uncommitted. It uses your Git identity, with a local commit identity when none is configured. Pass `--no-git` to skip repository creation. A generated app includes a GitHub Actions workflow that runs `pnpm run ci` against PostgreSQL and a `.railway/railway.ts` that defines PostgreSQL, builds the web and worker services, runs migrations before deployment, starts both processes and checks `/health` on the web service.

Run `pnpm run setup` after cloning the generated repository to install dependencies and the hook for that checkout. Run `pnpm ready` for the full local gate: lint, typecheck, build and tests, using the same script as CI.

`pnpm dev` first runs `pnpm db:setup` to prepare both databases through `@shivaedev/local-postgres`. Have local PostgreSQL 18.6 on port 55432 or Docker available; see [local-postgres machine setup](https://github.com/ShivaeDev/platform/tree/main/packages/local-postgres#install-and-machine-setup). `pnpm test` loads `TEST_DATABASE_URL` from `.env.local`.

The command also supports `--help` and `--version`. See the [framework quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md) for the starter's application and deployment workflow.
