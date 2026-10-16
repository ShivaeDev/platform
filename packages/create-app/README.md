# @shivaedev/create-app

Start a Platform application without copying repository files or editing workspace dependencies. One command creates the maintained starter, installs its published dependencies and shows the steps to run it.

## From an empty folder to an app

The starter brings PostgreSQL, authenticated RPC and a React notes screen together in a small application you can change. Its source stays in Platform's `examples/starter`, so the generator carries the same app that the framework maintains.

```text
Created my-app.
```

## Create and run

Use Node 24 or newer and pnpm. The package contains a snapshot of the starter made when it is packed. Platform dependencies use exact versions from the starter's `published-versions.json`; its self-contained pnpm catalog pins the remaining dependencies. A release check rejects framework pins behind npm or a framework release in the same commit. The version manifest stays out of the generated app.

```sh
pnpm create @shivaedev/app my-app
```

The folder argument may include a parent path. Its final folder name becomes the package name and must be a lowercase npm name. The destination must be absent or empty, including hidden files. The command runs `pnpm install` and `pnpm format` in the generated app, so app-specific names keep the shared formatting. A failure in either command returns a nonzero exit status and leaves the app available for retry.

After installation, follow the printed steps:

```sh
cd my-app
pnpm dev
```

The generated app has its own README and `AGENTS.md`, with `CLAUDE.md` linked to that guidance. App names replace the template name in source files and paths; source identifiers remove separators and SQL prefixes use lowercase underscores, each limited to 48 characters. Database names use the normalization below. Non-secret files, including the installed lockfile, have mode 0644; `.env.local` has mode 0600.

The command writes a git-ignored `.env.local` with a fresh authentication secret and local development and test database URLs. Existing files are never overwritten. Database names replace dots and hyphens in the app name with underscores, prefix a name starting with a digit with `app_`, and limit the stem to 58 characters before adding `_dev` and `_test`.

`pnpm dev` first runs `pnpm db:setup` to prepare both databases through `@shivaedev/local-postgres`. Have local PostgreSQL 18.6 on port 55432 or Docker available; see [local-postgres machine setup](https://github.com/ShivaeDev/platform/tree/main/packages/local-postgres#install-and-machine-setup). `pnpm test` loads `TEST_DATABASE_URL` from `.env.local`; generated PostgreSQL test support reads only that setting.

The command also supports `--help` and `--version`. See the [framework quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md) for the starter's application and deployment workflow.
