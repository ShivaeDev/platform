# {{appName}}

This application runs on the ShivaeDev framework: Effect services and SQL on the server, native RPC contracts shared with React, and application-owned UI and authorization policy. Keep failures typed and preserve scope, interruption, transactions and authorization across boundaries. Prefer native Effect composition and the framework's existing APIs over a second path or helpers that hide them.

Shared declarations in `src/notes.ts` stay browser safe. PostgreSQL, migrations, services and the app host belong in `src/server`; screens, routing and forms belong in `src/client`. Keep this app's dependency catalog and TypeScript configuration self-contained.

Run `pnpm run setup` after cloning to install dependencies and the pre-commit hook. Use `pnpm dev` to prepare the local databases and start development, `pnpm test` for the app's tests, `pnpm format` for formatting, and `pnpm ready` for lint, typecheck, build and tests. Set `TEST_DATABASE_URL` to a dedicated PostgreSQL database whose role can create disposable test databases. A server change needs a real PostgreSQL and HTTP story; a form change needs a happy-dom story. Extend the kits in `src/test-support` with domain traits and verbs instead of building infrastructure inline in specs.

Read the [README](README.md) for setup and deployment, the [framework docs](https://github.com/ShivaeDev/platform/blob/main/docs/framework/README.md) for design boundaries, and the [quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md) for the application workflow. Never skip the pre-commit hook or raise a quality baseline to make a check pass.
