# @shivaedev/platform

The ShivaeDev framework for Effect applications in one dependency. Platform holds no code of its own: it depends on every runtime piece of the framework, and an application imports each piece by its own name.

## Why you want this

An Effect application built on this framework uses many packages that are released and tested together. Listing them one by one and keeping their versions aligned is busywork that drifts. Depend on platform instead and import what you need from the piece that owns it:

```ts
import { appHost } from "@shivaedev/server/appHost.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
```

## Using it

### How the shell works

Platform is a dependency shell. Its manifest lists every runtime piece at the versions released together, and it exports nothing but its `package.json`. An application never imports `@shivaedev/platform/...`; it imports a module from the piece that owns it, by that piece's name, exactly as a library does. One upgrade of platform moves every piece at once.

pnpm installs a dependency's dependencies out of an application's reach unless the application hoists them, so an application on platform hoists the `@shivaedev` scope. Without that setting the pieces are installed, but type checking cannot resolve an import of any piece the application does not list itself.

### Set up an application

Add `@shivaedev/platform` to `dependencies`, add `@shivaedev/test-story` and `@shivaedev/quality` to `devDependencies`, and hoist the scope in `pnpm-workspace.yaml`:

```yaml
publicHoistPattern: ["@shivaedev/*"]
```

The application lists no piece beside platform, and no test piece beside `@shivaedev/test-story`, which brings `@shivaedev/test` and `@shivaedev/test-sql`. Quality checks this: `manifests/application` asks for the hoist setting and names any duplicate entry to remove, and `imports/manifest` and Biome's undeclared-dependency check accept an application's imports of the pieces its entry points bring. `create-app` writes this setup for a new application and `create-app update` brings an existing one to it.

Platform forwards the pieces' peer dependencies as optional peers. Install the ones the pieces you use need, such as `effect`, `react`, `react-dom`, `pg`, `pg-boss` and `better-auth`; the starter lists them.

Only applications depend on platform. A library, or an application published for others to run with `pnpm dlx` or a global install, cannot rely on the hoist setting of the workspace that installs it, so it declares each piece it imports directly.

### Which package owns which job

| Job | Package |
| --- | --- |
| Services and Layers | [`@shivaedev/service`](https://github.com/ShivaeDev/platform/tree/main/packages/service#readme) |
| Persistence, repositories and migrations | [`@shivaedev/sql`](https://github.com/ShivaeDev/platform/tree/main/packages/sql#readme) |
| After-commit changes | [`@shivaedev/changes`](https://github.com/ShivaeDev/platform/tree/main/packages/changes#readme) |
| Queries, commands and live contracts | [`@shivaedev/contract`](https://github.com/ShivaeDev/platform/tree/main/packages/contract#readme) |
| Shared expected failures and redaction | [`@shivaedev/errors`](https://github.com/ShivaeDev/platform/tree/main/packages/errors#readme) |
| Request identity, sessions, permissions and Better Auth | [`@shivaedev/identity`](https://github.com/ShivaeDev/platform/tree/main/packages/identity#readme) |
| Roles and permission sets | [`@shivaedev/access`](https://github.com/ShivaeDev/platform/tree/main/packages/access#readme) |
| The application host | [`@shivaedev/server`](https://github.com/ShivaeDev/platform/tree/main/packages/server#readme) |
| Receiving signed webhooks | [`@shivaedev/webhooks`](https://github.com/ShivaeDev/platform/tree/main/packages/webhooks#readme) |
| Calls to outside HTTP APIs | [`@shivaedev/http`](https://github.com/ShivaeDev/platform/tree/main/packages/http#readme) |
| Client state in React | [`@shivaedev/react`](https://github.com/ShivaeDev/platform/tree/main/packages/react#readme) |
| Forms | [`@shivaedev/form`](https://github.com/ShivaeDev/platform/tree/main/packages/form#readme) |
| Background jobs | [`@shivaedev/jobs`](https://github.com/ShivaeDev/platform/tree/main/packages/jobs#readme) |
| Admin pages | [`@shivaedev/admin`](https://github.com/ShivaeDev/platform/tree/main/packages/admin#readme) |
| GitHub integration | [`@shivaedev/github`](https://github.com/ShivaeDev/platform/tree/main/packages/github#readme) |
| Local PostgreSQL for development | [`@shivaedev/local-postgres`](https://github.com/ShivaeDev/platform/tree/main/packages/local-postgres#readme) |
| Shared TypeScript types | [`@shivaedev/types`](https://github.com/ShivaeDev/platform/tree/main/packages/types#readme) |

Tests use [`@shivaedev/test-story`](https://github.com/ShivaeDev/platform/tree/main/packages/test-story#readme) and checks use [`@shivaedev/quality`](https://github.com/ShivaeDev/platform/tree/main/packages/quality#readme), both as development dependencies.
