# @shivaedev/admin

Admin tooling starts with an explicit list of pages and the operations each page needs. This package collects native Effect contracts behind a declared permission, so every page operation shares the same boundary.

## Declare the tools operators can use

Operators need one place to find the tools an application exposes, and an admin operation that forgot its permission check is a public operation. Here each admin page names its permission once, and every operation on the page, including its generated change subscription, requires it.

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

## Using it

### How to think about it

An admin page is a native `@shivaedev/contract` contract plus a stable id, route metadata and one permission middleware. The page applies that middleware to every operation in its contract, so no admin operation exists without a permission check. The registry merges the pages into one native RPC group, and server registration pairs each page id with the handler Layer the application writes. Everything else, from the admin shell and its views to session policy and the RPC host, stays with the application.

### Declare pages and the registry

Declare each page's queries, commands and streams with `@shivaedev/contract`, then pass its native contract to `adminPage`. The stable id identifies the page at server registration; route metadata belongs to the application's view. Author RPC namespaces in the contract name, such as `admin.jobs`.

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
const handlers = registration.handlers.pipe(Layer.provideMerge(permissionLayer(JobsPermission, sessions)));
```

Declare application roles with `@shivaedev/access`, grant the relevant domain permissions explicitly, and supply that role set through the session or auth configuration of `@shivaedev/identity`.

Pass `registration.group` and `handlers` to the existing application's RPC host on `/rpc`, merging them with its other groups and Layers as needed. The Platform host supplies generated change handlers; registration requires the page's application handlers. Handler Layer errors and service requirements remain inferred. Missing or extra page ids fail at registration; TypeScript also checks each Layer provides the handlers for its page.

### Pages owned by modules

Each module declares its own registry and calls `registerAdmin` with its own page handlers. The application host combines those registrations:

```ts
import { mergeAdminRegistrations } from "@shivaedev/admin/server/mergeAdminRegistrations.ts";

const admin = mergeAdminRegistrations(foundation.admin, catalog.admin);
```

Pass `admin.group` and `admin.handlers` to the application's RPC host. The combined registration exposes `pages` for navigation and preserves the handler Layers' errors and service requirements. Duplicate page ids across modules fail at the type level; duplicate paths and RPC tags fail at composition. A module cannot register a page without its handlers.

Browser composition uses `mergeAdminRegistries` from `@shivaedev/admin/registry.ts` with the modules' browser-safe registries. A client module can also contribute its registry's `pages` directly to the application's navigation. A feature module adds pages to its own registry and handlers to its own registration; the foundation does not import feature pages.

### Built-in Jobs page

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

The queries are `admin.jobs.health`, `admin.jobs.counts`, `admin.jobs.failed`, `admin.jobs.deadLettered` and `admin.jobs.job`. Counts take `{ queue }`; listings take `{ queue, limit, cursor? }` and return `{ jobs, next }`, where `next` is an `Option<string>`. Job lookup takes `{ queue, id }` and returns `Option<Job>`. Each job carries its queue, decoded payload, state, attempt and retry counts, output and timestamps. Dead-letter listings also carry `sourceId` and `sourceOutput`. Output and source output use the jobs package's `JobFailure | null` shape (`_tag` and redacted `message`). A zero page limit or malformed listing cursor is rejected as `BadRequest`. Timestamps use UTC `DateTime` values; the RPC encodes timestamps as strings and Options as nullable values. The queue's original codec encodes and decodes its payload across RPC, preserving its service requirements.

Schedule definitions from `defineSchedule` can be passed beside queues. A browser declaration can share just `{ _tag: "ScheduleDefinition", name }`; scheduled runs use a null payload schema for failed and dead-letter listings and job lookup. Calling `jobsPage()` with no arguments registers the same read-only page and serves health with no jobs and zero totals.

Health filters the runtime's monitor snapshot to the page's queues and recomputes totals from those queues. It has the same refresh timing as jobs health. Unregistered names, including dead-letter queue names passed directly, fail with `JobsQueueUnregistered`. Stored payload decoding failures become `JobsPayloadInvalid`; jobs operation failures become `JobsUnavailable`, carrying the operation name. These declared failures do not expose the original database error.

The default `jobsPage` declares no commands, and its bound client has no retry operation. Handler registration performs no jobs read, and a failed jobs request leaves other pages available. The application supplies the Jobs view and mounts the registration on its existing RPC host.

#### Declare retry explicitly

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

This variant adds only `admin.jobs.retry`, taking `{ queue, id }` and returning void. It requires `ReadJobs` (`jobs.read`) through the page middleware and `RetryJobs` (`jobs.retry`) from `@shivaedev/admin/permissions.ts` in the handler. A caller with only `jobs.read` receives `Forbidden` and the job stays failed. The handler uses the jobs package's existing retry for a failed job in a declared queue. Missing jobs and jobs in other states fail with `JobsNotFailed`; unregistered queue names, including dead-letter queues, fail with `JobsQueueUnregistered`. A dead-letter copy's id cannot retry its original.

A successful bound retry invalidates health, the affected queue's counts and both listings, and the original job's detail. Health retains the runtime monitor's refresh timing.

### Built-in Users page

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

Applications can call `listUsers(AppAccess, input)` and `changeUserRole(AppAccess, input)` from `@shivaedev/admin/server/users.ts` on the server. These enforce their respective domain permissions using `SessionUser`. Decode untrusted role input with `AppAccess.Role` before calling `changeUserRole` directly; native RPC performs that decode at the contract boundary. Identity resolves the caller's stored role through the session policy.

Keep Better Auth cookie caching disabled so requests see current permissions. Route role writes through this operation to retain the final-assigner policy: the policy covers only `admin.users.changeRole`, so disable Better Auth's `/admin/set-role`, `/admin/update-user` and `/admin/create-user` browser endpoints, which write roles outside it. Better Auth's server-side APIs stay available for trusted code such as a bootstrap command.

### Client permission routes

`adminPage` requires a permission middleware, including for custom pages. It applies that middleware to the whole contract, installs a read policy checking the page grant on every query, and exposes its permission as `page.route.permission`. Queries need no repeated page-grant policy. An additional query policy can restrict access further. Bound live queries use the same page grant as one-off reads. Set the React route's `staticData.permission` to that value. Use `permissionGuard` from `@shivaedev/react/permissionGuard.ts` in protected routes' `beforeLoad` and wrap the router in `PermissionBoundary` from `@shivaedev/react/client/permissionBoundary.ts` with the session and one application fallback.

### Install and limits

Install `@shivaedev/admin` with `effect`, `react` and `@effect/atom-react` as peers. The package has no root entry; import the module that defines the name.

Page declarations and the registry are browser-safe and add no transport. Server registration lives under `/server`, and the built-in Users view under `/client` uses React. Applications own route composition and styling.

This package declares the permission middleware and does not resolve sessions. `permissionLayer` from `@shivaedev/identity/server/permissions.ts` resolves each request's session through the session policy the application supplies, then checks the page's permission.
