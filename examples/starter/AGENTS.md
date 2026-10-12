# Starter application

This private application is the folder a new Platform app copies. Keep it small enough to understand in one sitting: one domain table, one query, one command, a notes screen and a sign-in screen. Better Auth owns its account and session tables; the starter's numbered migration path creates them. Prefer native Effect composition and the framework's existing path over helpers that obscure it.

The application owns its UI and local session policy. Shared declarations stay browser safe; PostgreSQL, services and the app host stay on the server. Keep the pnpm catalog and TypeScript configuration self-contained so copying the folder does not require repository files.

Use the root repository guidance while developing here. The [quickstart](../../docs/framework/quickstart.md) explains running and copying the app. A server change needs the real PostgreSQL round-trip test; a form change needs its happy-dom test.
