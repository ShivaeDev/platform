# @shivaedev/admin

Admin tooling starts with an explicit list of pages and the operations each page needs. This package collects native Effect contracts behind a declared permission, so every page operation shares the same boundary.

## Declare the tools operators can use

```ts
const Jobs = adminPage({
  id: "jobs",
  permission: JobsPermission,
  route: { path: "/admin/jobs", title: "Jobs" },
  contract: contract("admin.jobs", { queries: [Failed] }),
});
const Admin = adminRegistry(Jobs);
```

The page exposes `admin.jobs.failed` and the generated `admin.jobs.$changes` subscription. Both require `JobsPermission`, which checks `ReadJobs` (`jobs.read`). A query-only contract has no command. The application grants this permission to its chosen roles.

## Use native contracts and Layers

Install `@shivaedev/admin` with `effect`, `react` and `@effect/atom-react`. Declare each page's queries, commands and streams with `@shivaedev/contract`, then pass its native contract to `adminPage`. The stable id identifies the page at server registration; route metadata belongs to the application's view. Author RPC namespaces in the contract name, such as `admin.jobs`.

```ts
import { Schema } from "effect";
import { JobsPermission } from "@shivaedev/admin/permissions.ts";
import { adminPage } from "@shivaedev/admin/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";

const Failed = query("failed", {
  reads: () => [],
  success: Schema.Array(Schema.String),
});
const Jobs = adminPage({
  id: "jobs",
  permission: JobsPermission,
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
import { JobsPermission, ReadJobs } from "@shivaedev/admin/permissions.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";

const registration = registerAdmin(Admin, {
  jobs: Jobs.contract.application.toLayer({
    "admin.jobs.failed": () => Effect.succeed(["mail-42"]),
  }),
});
const handlers = registration.handlers.pipe(
  Layer.provideMerge(permissionLayer(JobsPermission, sessions)),
);
```

Declare application roles with `@shivaedev/access`, grant the relevant domain permissions explicitly, and supply that role set through the session or auth configuration of `@shivaedev/identity`.

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

Schedule definitions from `defineSchedule` can be passed beside queues. A browser declaration can share just `{ _tag: "ScheduleDefinition", name }`; scheduled runs use a null payload schema for failed and dead-letter listings and job lookup. Calling `jobsPage()` with no arguments registers the same read-only page and serves health with no jobs and zero totals.

Health filters the runtime's monitor snapshot to the page's queues and recomputes totals from those queues. It has the same refresh timing as jobs health. Unregistered names, including dead-letter queue names passed directly, fail with `JobsQueueUnregistered`. Stored payload decoding failures become `JobsPayloadInvalid`; jobs operation failures become `JobsUnavailable`, carrying the operation name. These declared failures do not expose the original database error.

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

This variant adds only `admin.jobs.retry`, taking `{ queue, id }` and returning void. It requires `ReadJobs`, through the same page middleware. The handler uses the jobs package's existing retry for a failed job in a declared queue. Missing jobs and jobs in other states fail with `JobsNotFailed`; unregistered queue names, including dead-letter queues, fail with `JobsQueueUnregistered`. A dead-letter copy's id cannot retry its original.

A successful bound retry invalidates health, the affected queue's counts and both listings, and the original job's detail. PostgreSQL stories mount these query atoms, retry through authenticated serialized RPC, and observe refetching and a second worker execution. Health retains the runtime monitor's refresh timing.

## Built-in Users page

Call `usersPage(AppAccess)` from `@shivaedev/admin/users/page.ts` with the application's code-defined role set. Add the returned page to the same registry as Jobs and register `users: usersHandlers(UsersPage, AppAccess)` from `@shivaedev/admin/server/usersHandlers.ts`. The handlers use the application's existing Effect SQL client against Better Auth's default PostgreSQL `user` table and its `role` column. Custom table or column names are not supported.

Each user stores one role string accepted by `AppAccess.Role`. Each role declares an explicit permission list in application code. The Users area assigns roles; it does not edit their grants.

Bind the page's contract to the registry's native AtomRpc client, then mount the view in the application's admin shell. Tailwind applications include `@source "../../node_modules/@shivaedev/admin/src/client";` in `src/client/entry.css`:

```tsx
import { UsersView } from "@shivaedev/admin/client/UsersView.ts";

const users = bind(UsersPage.contract, Client);
const changeRole = Client.runtime.fn(users.changeRole.run);

<UsersView roles={AppAccess.Role.literals} list={users.list.query} changeRole={changeRole} />;
```

`admin.users.list` takes `{ limit, cursor? }` (1–100 users) and returns `{ users, next, canChangeRoles }` ordered by user id. Each user has id, name, email, role and a UTC sign-up time. The page's operations and generated subscription require `ReadUsers` (`users.read`), enforced by `UsersPermission`. Supply `permissionLayer(UsersPermission, sessions)` alongside the application's other handler Layers.

`admin.users.changeRole` takes `{ userId, role }`; its role Schema is the application's declared role union. The handler also requires `AssignRoles` (`roles.assign`). The view shows a role select only to callers with that permission. Role writes serialize in a transaction and return `LastRoleAssigner` if replacing the final holder's role would remove `roles.assign`, regardless of the role's name. A missing user returns `NotFound`. Changes invalidate the list after commit and emit an Effect log with actor id, target id, role and timestamp.

Applications can call `listUsers(AppAccess, input)` and `changeUserRole(AppAccess, input)` from `@shivaedev/admin/server/users.ts` on the server. These enforce their respective domain permissions using `SessionUser`.

Keep Better Auth cookie caching disabled so requests see current permissions. Route role writes through this operation to retain the final-assigner policy. The starter disables Better Auth's `/admin/set-role`, `/admin/update-user` and `/admin/create-user` browser endpoints; its server-side bootstrap API remains available.

## Client permission routes

`adminPage` requires a permission middleware, including for custom pages. It applies that middleware to the whole contract and exposes its permission as `page.route.permission`. Set the React route's `staticData.permission` to that value. Use `permissionGuard` from `@shivaedev/react/permissionGuard.ts` in protected routes' `beforeLoad` and wrap the router in `PermissionBoundary` from `@shivaedev/react/client/permissionBoundary.ts` with the session and one application fallback. The starter uses this path for Users, Jobs and note statistics.
