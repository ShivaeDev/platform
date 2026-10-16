# __APP_NAME__

This app uses the ShivaeDev framework: native Effect services and Layers, PostgreSQL repositories, typed RPC and React query and form state. Keep shared contracts browser safe and database access, services and the HTTP host on the server. Application policy, UI text and layout belong here.

Extend the existing framework paths before adding abstractions: `defineService` for services, `makeRepository` and numbered migrations for persistence, `query` and `command` for operations, and `useQuery`, `useAction`, `useEditor` and `useCreate` for the client. Preserve typed failures, scope, interruption, transactions and authorization across boundaries.

Use `pnpm dev` for local development, `pnpm lint` and `pnpm typecheck` for checks, `pnpm test` for tests, and `pnpm build && pnpm start` for deployment. See [README.md](README.md) for setup and environment settings. The [framework docs](https://github.com/ShivaeDev/platform/blob/main/docs/framework/README.md) explain the design and link to package APIs and the deployment guide.

Write tests on the kits in `src/test-support`: `application.ts` for real PostgreSQL and HTTP, `screens.ts` for happy-dom behavior, and `migration.ts` for schema upgrades. Add domain traits and verbs to the kits; keep infrastructure scoped and use a live clock for HTTP and DOM stories. Run database tests with a dedicated `TEST_DATABASE_URL` whose role can create disposable databases.
