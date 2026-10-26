# @shivaedev/platform

The ShivaeDev framework for Effect applications in one dependency. Platform holds no code of its own: it depends on every runtime piece of the framework, and an application imports each piece by its own name.

## Why you want this

An Effect application built on this framework uses a dozen packages that are released and tested together. Listing them one by one and keeping their versions aligned is busywork that drifts. Depend on platform instead and import what you need from the piece that owns it:

```ts
import { appHost } from "@shivaedev/server/appHost.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
```

## Using it

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
| Calls to outside HTTP APIs | [`@shivaedev/http`](https://github.com/ShivaeDev/platform/tree/main/packages/http#readme) |
| Client state in React | [`@shivaedev/react`](https://github.com/ShivaeDev/platform/tree/main/packages/react#readme) |
| Forms | [`@shivaedev/form`](https://github.com/ShivaeDev/platform/tree/main/packages/form#readme) |
| Background jobs | [`@shivaedev/jobs`](https://github.com/ShivaeDev/platform/tree/main/packages/jobs#readme) |
| Admin pages | [`@shivaedev/admin`](https://github.com/ShivaeDev/platform/tree/main/packages/admin#readme) |
| GitHub integration | [`@shivaedev/github`](https://github.com/ShivaeDev/platform/tree/main/packages/github#readme) |
| Local PostgreSQL for development | [`@shivaedev/local-postgres`](https://github.com/ShivaeDev/platform/tree/main/packages/local-postgres#readme) |
| Shared TypeScript types | [`@shivaedev/types`](https://github.com/ShivaeDev/platform/tree/main/packages/types#readme) |

Tests use [`@shivaedev/test-story`](https://github.com/ShivaeDev/platform/tree/main/packages/test-story#readme) and checks use [`@shivaedev/quality`](https://github.com/ShivaeDev/platform/tree/main/packages/quality#readme), both as development dependencies.
