# Starter application

This private application is the source template that `@shivaedev/create-app` packages for new Platform apps. Keep it small enough to understand in one sitting: one domain table, an authenticated notes workflow and a sign-in screen. Better Auth owns its account and session tables; the starter's numbered migration path creates them. Prefer native Effect composition and the framework's existing path over helpers that obscure it.

The application owns its UI and local session policy. Shared declarations stay browser safe; PostgreSQL, services and the app host stay on the server. Keep the pnpm catalog and TypeScript configuration self-contained so generating the app does not require repository files.

Use the root repository guidance while developing this template. The [quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md) explains creating and running the app. A server change needs the real PostgreSQL round-trip test; a form change needs its happy-dom test.

Write new tests as stories following the [story-testing skill](../../packages/skills/skills/story-testing/SKILL.md), the source of the rules for evidence, setup, kit responsibilities, preconditions, isolation and focused runs. Extend the kits in `src/test-support/`: `application.ts` for real PostgreSQL and HTTP, `screens.ts` for focused happy-dom behavior, `migration.ts` for schema upgrades, and `authPool.ts` for the Better Auth PostgreSQL pool and its connection recovery. Verbs act, readouts return values, and specs state expectations; keep assertions out of test-support. Keep infrastructure scoped and use a live clock for HTTP and DOM stories. See the README for the smallest story.
