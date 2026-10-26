# @shivaedev/admin

Admin tooling starts with an explicit list of pages and the operations each page needs. This package collects native Effect contracts behind a declared permission, so every page operation shares the same boundary.

## Declare the tools operators can use

```ts
const Jobs = adminPage({
  id: "jobs",
  route: { path: "/admin/jobs", title: "Jobs" },
  contract: contract("admin.jobs", { queries: [Failed] }),
});
const Admin = adminRegistry(Jobs);
```

The page exposes `admin.jobs.failed` and the generated `admin.jobs.$changes` subscription. Both require `AdminPermission`, which checks the `OpenAdmin` permission (`admin.open`). A query-only contract has no command. The application grants this permission to its chosen roles.

## Use native contracts and Layers

Install `@shivaedev/admin` with `effect`, `react` and `@effect/atom-react`. Declare each page's queries, commands and streams with `@shivaedev/effect-contract`, then pass its native contract to `adminPage`. The stable id identifies the page at server registration; route metadata belongs to the application's view. Author RPC namespaces in the contract name, such as `admin.jobs`.

```ts
import { Schema } from "effect";
import { adminPage } from "@shivaedev/admin/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";

const Failed = query("failed", {
  reads: () => [],
  success: Schema.Array(Schema.String),
});
const Jobs = adminPage({
  id: "jobs",
  route: { path: "/admin/jobs", title: "Jobs" },
  contract: contract("admin.jobs", { queries: [Failed] }),
});
const Admin = adminRegistry(Jobs);
```

`Jobs.contract` keeps the native `.declaration` and `.application.toLayer` APIs. `adminRegistry(...pages)` returns `pages` and a native `group`. Duplicate page ids, route paths and RPC tags, including generated subscriptions, fail when the registry is created.

Register server handler Layers by page id:

```ts
import { Effect, Layer } from "effect";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { AdminPermission, OpenAdmin } from "@shivaedev/admin/permissions.ts";
import { permissionLayer } from "@shivaedev/platform/server/rpc-server/permissions.ts";

const registration = registerAdmin(Admin, {
  jobs: Jobs.contract.application.toLayer({
    "admin.jobs.failed": () => Effect.succeed(["mail-42"]),
  }),
});
const handlers = registration.handlers.pipe(
  Layer.provideMerge(permissionLayer(AdminPermission, sessions)),
);
```

Declare application roles with `@shivaedev/access`, grant `OpenAdmin` explicitly, and supply that role set through Platform's session or auth configuration.

Pass `registration.group` and `handlers` to the existing application's RPC host on `/rpc`, merging them with its other groups and Layers as needed. The Platform host supplies generated change handlers; registration requires the page's application handlers. Handler Layer errors and service requirements remain inferred. Missing or extra page ids fail at registration; TypeScript also checks each Layer provides the handlers for its page.

Page declarations and the registry are browser-safe. Server registration lives under `/server`; applications own route composition and styling. The built-in Users view uses React; server declarations add no transport. The package's stories prove permission enforcement through native in-process RPC, with an already resolved session as a precondition.

## Built-in Jobs page

Share each queue's name and payload Schema with the browser declaration. The page exposes only the queues passed to `jobsPage`; a queue registered with the jobs runtime is not automatically available to operators.

```ts
import { Schema } from "effect";
import { jobsPage } from "@shivaedev/admin/jobs/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";

const MailPayload = Schema.Struct({ id: Schema.NumberFromString });
const JobsPage = jobsPage({ name: "mail", schema: MailPayload });
const Admin = adminRegistry(JobsPage);
```

Register its handlers with the application's existing `makePgBoss` service:

```ts
import { jobsHandlers } from "@shivaedev/admin/server/jobsHandlers.ts";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";

const registration = registerAdmin(Admin, {
  jobs: jobsHandlers(JobsPage, JobsService),
});
```

The queries are `admin.jobs.health`, `admin.jobs.counts`, `admin.jobs.failed`, `admin.jobs.deadLettered` and `admin.jobs.job`. Counts take `{ queue }`; listings take `{ queue, limit, cursor? }` and return `{ jobs, next }`, where `next` is an `Option<string>`. Job lookup takes `{ queue, id }` and returns `Option<Job>`. Each job carries its queue, decoded payload, state, attempt and retry counts, output and timestamps. Dead-letter listings also carry `sourceId` and `sourceOutput`. Timestamps use UTC `DateTime` values; the RPC encodes timestamps as strings and Options as nullable values. The queue's original codec encodes and decodes its payload across RPC, preserving its service requirements.

Health filters the runtime's monitor snapshot to the page's queues and recomputes totals from those queues. It has the same refresh timing as effect-pg-boss health. Unregistered names, including dead-letter queue names passed directly, fail with `JobsQueueUnregistered`. Stored payload decoding failures become `JobsPayloadInvalid`; jobs operation failures become `JobsUnavailable`, carrying the operation name. These declared failures do not expose the original database error.

The default `jobsPage` declares no commands, and its bound client has no retry operation. Handler registration performs no jobs read, and a failed jobs request leaves other pages available. PostgreSQL stories exercise these queries through serialized `/rpc` requests, including pagination, transformed payloads, missing jobs, queue restrictions and permission enforcement. The application supplies the Jobs view and mounts the registration on its existing RPC host.

### Declare retry explicitly

Use `jobsPageWithRetry` and `jobsHandlersWithRetry` when administrators should be able to retry failed original jobs:

```ts
import { jobsPageWithRetry } from "@shivaedev/admin/jobs/retryPage.ts";
import { jobsHandlersWithRetry } from "@shivaedev/admin/server/jobsHandlersWithRetry.ts";

const JobsPage = jobsPageWithRetry({ name: "mail", schema: MailPayload });
const Admin = adminRegistry(JobsPage);
const registration = registerAdmin(Admin, {
  jobs: jobsHandlersWithRetry(JobsPage, JobsService),
});
```

This variant adds only `admin.jobs.retry`, taking `{ queue, id }` and returning void. It requires `OpenAdmin`, through the same page middleware. The handler uses effect-pg-boss's existing retry for a failed job in a declared queue. Missing jobs and jobs in other states fail with `JobsNotFailed`; unregistered queue names, including dead-letter queues, fail with `JobsQueueUnregistered`. A dead-letter copy's id cannot retry its original.

A successful bound retry invalidates health, the affected queue's counts and both listings, and the original job's detail. PostgreSQL stories mount these query atoms, retry through authenticated serialized RPC, and observe refetching and a second worker execution. Health retains the runtime monitor's refresh timing.

## Built-in Users page

`UsersPage` from `@shivaedev/admin/users/page.ts` declares `/admin/users`. Add it to the same registry as Jobs and register `users: usersHandlers` from `@shivaedev/admin/server/usersHandlers.ts`. The handlers use the application's existing Effect SQL client against Better Auth's default PostgreSQL `user` table, with the admin plugin's `role` column. They do not create another user store. Custom Better Auth table or column names are not supported by these handlers.

Bind `UsersPage.contract` to the registry's native AtomRpc client, then mount the package view in the application's admin shell. The view uses semantic HTML and Tailwind utility classes; Tailwind applications include `@source "../../node_modules/@shivaedev/admin/src/client";` in `src/client/entry.css`, as the starter does:

```tsx
import { UsersView } from "@shivaedev/admin/client/UsersView.ts";

const users = bind(UsersPage.contract, Client);
const changeRole = Client.runtime.fn(users.changeRole.run);

<UsersView list={users.list.query} changeRole={changeRole} />;
```

`admin.users.list` takes `{ limit, cursor? }` (1–100 users), returns `{ users, next, canChangeRoles }`, and orders pages by user id. Each user has id, name, email, roles and a UTC sign-up time. All reads and subscriptions require `OpenAdmin`. Callers granted `ChangeUserRoles` (`users.roles.change`) from Platform's `rpc/userRoles.ts` see role controls. `admin.users.changeRole` takes `{ userId, role, grant }` for Platform's `user`, `admin` and `owner` roles. It returns typed `Forbidden` without that permission, `LastOwner` when revoking the final owner, and `NotFound` for a missing user. Role changes preserve other roles, invalidate the list after commit, and emit an Effect log with actor id, target id, role, action and timestamp. There is no durable audit-history store.

Keep Better Auth cookie caching disabled so requests see current roles. Applications must route role writes through this operation to retain its permission and last-owner policy. The starter disables Better Auth's `/admin/set-role`, `/admin/update-user` and `/admin/create-user` browser endpoints; its server-side bootstrap API remains available.

The starter mounts Users beside Jobs and bootstraps new administrators with both `admin` and `owner`. Existing generated apps receive this wiring through `pnpm dlx @shivaedev/create-app@latest update` after release; review conflicts and install dependencies. For an existing database with no owner, bootstrap a new administrator with `pnpm admin:create`.
