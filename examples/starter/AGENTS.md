# Starter application

This private application is the source template that `@shivaedev/create-app` packages for new Platform apps. Keep it small enough to understand in one sitting: one domain table, one query, one command, a notes screen and a sign-in screen. Better Auth owns its account and session tables; the starter's numbered migration path creates them. Prefer native Effect composition and the framework's existing path over helpers that obscure it.

The application owns its UI and local session policy. Shared declarations stay browser safe; PostgreSQL, services and the app host stay on the server. Keep the pnpm catalog and TypeScript configuration self-contained so generating the app does not require repository files.

Use the root repository guidance while developing this template. The [quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md) explains creating and running the app. A server change needs the real PostgreSQL round-trip test; a form change needs its happy-dom test.
