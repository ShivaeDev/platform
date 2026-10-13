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

The folder argument may include a parent path. Its final folder name becomes the package name and must be a lowercase npm name. The destination must be absent or empty, including hidden files. The command runs `pnpm install` in the generated app and reports an installation failure with a nonzero exit status.

After installation, follow the printed steps:

```sh
cd my-app
cp .env.example .env.local
```

Set `DATABASE_URL` to your PostgreSQL database and `BETTER_AUTH_SECRET` to a random secret of at least 32 characters, then run:

```sh
pnpm dev
```

The command also supports `--help` and `--version`. It creates files and installs dependencies; it does not create your database or set secrets. See the [framework quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md) for the starter's application and deployment workflow.
