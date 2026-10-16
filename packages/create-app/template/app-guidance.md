# __APP_NAME__

This application uses the ShivaeDev framework: native Effect services and Layers, PostgreSQL repositories, typed RPC and React queries and forms. Keep application policy, authentication choices and UI here. Prefer the framework's existing paths over parallel abstractions, and keep shared contracts browser safe while database access and services stay on the server.

Read the [framework documentation](https://github.com/ShivaeDev/platform/blob/main/docs/framework/README.md) and [quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md) before changing a framework boundary. Each installed `@shivaedev` package has its usage guide in its README. The [application README](README.md) covers setup and deployment.

Use `pnpm dev` for local development; it prepares the development and test databases first. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` before handing off a change. Apply formatting with `pnpm format`. Server behavior needs the real PostgreSQL and HTTP tests; React behavior uses the happy-dom tests. Keep `.env.local` private and use a dedicated `TEST_DATABASE_URL` for tests. Production runs with `pnpm start`, with `pnpm worker` for background jobs.
