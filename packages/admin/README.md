# @shivaedev/admin

Admin tooling starts with an explicit list of pages and the operations each page needs. This package collects native Effect contracts behind a declared permission, so every page operation shares the same boundary.

## Declare the tools operators can use

Operators need one place to find the tools an application exposes, and an admin operation that forgot its permission check is a public operation. Here each admin page names its permission once, and every operation on the page, including its generated change subscription, requires it.

```ts
const Jobs = adminPage({
	id: "jobs",
	permission: JobsPermission,
	route: { path: "/admin/jobs", title: "Jobs" },
	contract: Failed,
});
const Admin = adminRegistry(Jobs);
```

`Failed` is the browser contract of an `admin.jobs` module with one `failed` query. The page exposes `admin.jobs.failed` and the generated `admin.jobs.$changes` subscription. Both require `JobsPermission`, which checks `ReadJobs` (`jobs.read`). A query-only contract has no command. The application grants this permission to its chosen roles.

## Using it

### How to think about it

With the application host, a generated query subscription returns its first authorized result after registering read keys. Bound admin screens consume that value in one RPC request. Raw subscription readers handle `Result` values alongside later change hints.

An admin page is a native `@shivaedev/contract` contract, normally the browser contract generated from a module built with `defineModule`, plus a stable id, route metadata and one permission middleware. The page applies that middleware to every operation in its contract, so no admin operation exists without a permission check. The browser calls a page through its contract. Server registration pairs each page id with the module that defines the page's operations and serves that module under the page's permission, so the module's read keys, `invalidates` and read policies are the ones the host uses. Admin supplies optional default React views for Users, Sessions and Jobs. The application owns the admin shell, custom views, route composition, styling, session policy and RPC host.

### Declare pages and the registry

Write a page's operations once, as a module built with `defineModule` from `@shivaedev/contract/defineModule.ts`: each operation is its `payload` and `*run`, and `pnpm generate` writes the browser contract from the module. Give the module the page's permission middleware, so `run` can read `SessionUser`. Author RPC namespaces in the module name, such as `admin.jobs`. The module file is server code; for a wholly admin-only jobs feature, put it in `src/modules/admin/jobs/Failed.ts`:

```ts
import { JobsPermission } from "@shivaedev/admin/permissions.ts";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { adminJobsWire } from "#generated/modules/admin/jobs/Failed.ts";
import { ListFailed } from "#modules/admin/jobs/server/ListFailed.ts";

export const Failed = defineModule({
	middleware: JobsPermission,
	name: "admin.jobs",
	operations: [ListFailed],
	wire: adminJobsWire,
});
```

Pass the generated contract, which has the module's name, to `adminPage` in the browser-safe `src/modules/admin/jobs/pages.ts`. The stable id identifies the page at server registration; route metadata belongs to the application's view.

```ts
import { JobsPermission } from "@shivaedev/admin/permissions.ts";
import { adminPage } from "@shivaedev/admin/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { Failed } from "#generated/modules/admin/jobs/Failed.ts";

export const Jobs = adminPage({ contract: Failed, id: "jobs", permission: JobsPermission, route: { path: "/admin/jobs", title: "Jobs" } });
export const Admin = adminRegistry(Jobs);
```

`adminRegistry(...pages)` returns `pages`. Duplicate page ids and RPC tags, including generated subscriptions, fail when the registry is created. Route patterns that can match the same path also fail, including a static page that overlaps another page's `$` detail parameter. Choose distinct routes rather than relying on route order.

Register each page's module by page id in `src/modules/admin/jobs/server/registration.ts`. Registration serves the module through its generated handlers, which run each query's read policy inside its handler, and applies the page's permission to every RPC of the module:

```ts
import { Layer } from "effect";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { Failed } from "#modules/admin/jobs/Failed.ts";
import { Admin } from "#modules/admin/jobs/pages.ts";

const registration = registerAdmin(Admin, { jobs: Failed });
const sessions = Layer.succeed(SessionPolicy, { origin, provider, roles: Access });
const handlers = registration.handlers;
```

Declare application roles with `@shivaedev/access`, grant the relevant domain permissions explicitly, and supply that role set through the session or auth configuration of `@shivaedev/identity`.

Pass `registration.group` and `handlers` to the existing application's RPC host on `/rpc`, merging them with its other groups and Layers as needed, or attach the registration as a server module's `admin` field. `registration.group` holds the modules' RPCs, so the host takes each admin query's live keys and each admin command's `invalidates` from the module, never from the browser contract. The Platform host supplies generated change handlers. The handler Layer requires the services the modules' operations yield. A module must serve exactly its page's operations: TypeScript refuses a missing module, an extra page id and a module whose operations differ from its page's, and the handler Layer defects on each when it is built, so a module with more operations cannot widen a page.

### Protect documents and detail routes

Provide the application's session policy through `SessionPolicy` once. Registration builds each page's permission layer with that policy. The handler Layer requires identity's `SessionPolicy` service.

A page can declare `route: { path: "/admin/workspaces", detail: "/admin/workspaces/$id", title: "Workspaces" }`. The detail must be a descendant of the page's path; composition rejects a detail elsewhere or equal to the page path. Mount `adminDocuments(registration, handler)` from `@shivaedev/admin/server/adminDocuments.ts` beside the application's public document routes and provide the same `SessionPolicy` layer. The handler serves the application's document; the guard checks the matched page's permission first. Unregistered admin paths return 404. `/admin` and `/admin/` use the first registered page's permission.

Use `adminPermissionGuard(registration.pages, permissionGuard({ session, signedOut }))` from `@shivaedev/admin/client/adminPermissionGuard.ts` as the client root route's `beforeLoad`, using the native `permissionGuard` from `@shivaedev/react/adapters/permissionGuard.ts`. It applies the matched list or detail page's permission together with other route permissions. Like the document guard, `/admin` and `/admin/` use the first registered page's permission. The application still declares the detail component in its router.

### Pages owned by modules

Each module declares its own registry and calls `registerAdmin` with its own page modules. The application host combines those registrations:

```ts
import { mergeAdminRegistrations } from "@shivaedev/admin/server/mergeAdminRegistrations.ts";

const admin = mergeAdminRegistrations(foundation.admin, catalog.admin);
```

Pass the policy Layer once as `appHost({ sessions, handlers: admin.handlers, group: admin.group })`. Custom hosts provide it to their composed middleware and routes with `Layer.provide(sessions)`. The combined registration exposes `pages` for navigation and `group` for the host, and preserves the handlers' service requirements. Duplicate page ids across modules fail at the type level; duplicate paths and RPC tags fail at composition. A module cannot contribute a page without registering it.

Browser composition uses `mergeAdminRegistries` from `@shivaedev/admin/registry.ts` with the modules' browser-safe registries. A client module can also contribute its registry's `pages` directly to the application's navigation. A registry holds pages and no RPC group. Browser code that needs one group for its pages merges their contracts, `RpcGroup.make().merge(...Admin.pages.map((page) => page.contract))`, or passes each page's contract to `makeClient`. Only server code reads `registration.group`; importing the registration into browser code pulls the server modules into the browser bundle. A feature module adds pages to its own registry and their modules to its own registration; the foundation does not import feature pages.

### Keep admin code in admin paths

An `admin/` path segment means admin-only code. A wholly admin-only feature lives under `src/modules/admin/<name>`, with its shared declarations, `server/` and `client/` there. Admin tools for a member feature stay inside that feature: `admin/` for the admin module and its browser-safe page declarations, `server/admin/` for its operations, and `client/admin/` for bindings and views. Each module reads only its own tables; compose another module's exposed operations for data it owns. Permissions enforce access regardless of the path.

The starter writes the statistics read once as an operation in [`src/modules/notes/server/admin/Read.ts`](https://github.com/ShivaeDev/platform/blob/main/examples/starter/src/modules/notes/server/admin/Read.ts):

```ts
import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { query } from "@shivaedev/contract/operation.ts";
import { notes } from "#modules/notes/model.ts";

const Totals = Schema.Struct({ notes: Schema.Number, pending: Schema.Number, words: Schema.Number });

export const Read = query("statistics", {
	reads: () => [notes.list],
	*run() {
		const sql = yield* SqlClient.SqlClient;
		const read = SqlSchema.findOne({
			execute: () => sql`select count(*)::int as notes, count(*) filter (where word_count is null)::int as pending,
				coalesce(sum(word_count), 0)::int as words from notes`,
			Request: Schema.Void,
			Result: Totals,
		});
		// An aggregate without grouping always returns one row.
		return yield* read(undefined).pipe(Effect.catchTag("NoSuchElementError", Effect.die));
	},
});
```

Its module, [`src/modules/notes/admin/Statistics.ts`](https://github.com/ShivaeDev/platform/blob/main/examples/starter/src/modules/notes/admin/Statistics.ts), lists that operation under the page's permission. [`src/modules/notes/admin/pages.ts`](https://github.com/ShivaeDev/platform/blob/main/examples/starter/src/modules/notes/admin/pages.ts) declares `StatisticsPage` with `adminPage` over the generated contract, and [`src/modules/notes/server/admin/registration.ts`](https://github.com/ShivaeDev/platform/blob/main/examples/starter/src/modules/notes/server/admin/registration.ts) serves the module:

```ts
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { Admin } from "#modules/notes/admin/pages.ts";
import { Statistics } from "#modules/notes/admin/Statistics.ts";

export const adminRegistration = registerAdmin(Admin, {
	"note-statistics": Statistics,
});
```

The read stays in notes because notes owns the table. The [client registration](https://github.com/ShivaeDev/platform/blob/main/examples/starter/src/modules/notes/client/admin/registration.tsx) and view stay in `src/modules/notes/client/admin/`. Application composition may import these registrations from its member and admin module lists without moving their implementation out of the owning module.

### Built-in Jobs page

Add `JobsPage` from `@shivaedev/admin/jobs/Page.ts` to the registry and register `jobs: Jobs`, with `Jobs` from `@shivaedev/admin/Jobs.ts`, the module behind the page, which is server code. The module requires `RegisteredQueues` from `@shivaedev/admin/server/RegisteredQueues.ts`: the queues operators may administer and the jobs runtime they run on. Provide it with `pgBossQueues` from `@shivaedev/admin/server/adapters/pgBossQueues.ts`, passing the application's existing `makePgBoss` service and each queue's name, optional display label, subject columns and payload Schema. The page exposes only those queues; a queue registered with the jobs runtime is not automatically available to operators.

```ts
import { Layer, Schema } from "effect";
import { Jobs } from "@shivaedev/admin/Jobs.ts";
import { JobsPage } from "@shivaedev/admin/jobs/Page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { pgBossQueues } from "@shivaedev/admin/server/adapters/pgBossQueues.ts";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";

const Mail = {
	name: "mail",
	label: "Email delivery",
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	subject: [{ field: "id", label: "Message" }],
};
const registration = registerAdmin(adminRegistry(JobsPage), { jobs: Jobs });
const queues = pgBossQueues(JobsService, Mail);
const handlers = registration.handlers.pipe(Layer.provide(queues));
```

The `pgBossQueues` Layer requires the jobs service and the payload Schemas' decoding services, so the page's operations require only `RegisteredQueues`.

The queries are `admin.jobs.health`, `admin.jobs.counts`, `admin.jobs.failed`, `admin.jobs.deadLettered` and `admin.jobs.job`. Counts take `{ queue }`; listings take `{ queue, limit, cursor? }` and return `{ jobs, next }`, where `next` is an `Option<string>`. Job lookup takes `{ queue, id }` and returns `Option<JobsRow>`. Each job is a `JobsRow` from `@shivaedev/admin/jobs/Row.ts` carrying its queue, decoded payload, state, attempt and retry counts, output and timestamps. Dead-letter listings return `JobsDeadLetter` from `@shivaedev/admin/jobs/DeadLetter.ts`, which also carries `sourceQueue`, `sourceId` and `sourceOutput`. `sourceQueue` names the original queue, so readers can route to it directly. Once the original succeeds, its copies leave the dead-letter listing. Output and source output use the jobs package's `JobFailure | null` shape (`_tag` and redacted `message`). A zero page limit or malformed listing cursor is rejected as `BadRequest`. Timestamps use UTC `DateTime` values. Jobs decodes the durable payload and masks native `Redacted` values and sensitive keys before the RPC response. Payloads are diagnostic `data: unknown`; narrow them before reading fields. Result serialization does not run the queue's payload encoder or require its encoding services.

Schedule definitions from `defineSchedule` can be passed beside queues. For a worker-only schedule, share a browser-safe object such as `const Cleanup = { name: "cleanup" } as const`. Pass `Cleanup` to `pgBossQueues` and spread it into the worker's `defineSchedule({ ...Cleanup, cron: "17 3 * * *" })`. Scheduled runs use a null payload schema for failed and dead-letter listings and job lookup. With no queues, `pgBossQueues(JobsService)` serves health with no jobs and zero totals.

Health reads the declared queues in declaration order, including schedules registered by a separate worker service, and totals only those queues. It has the same refresh timing as jobs health. Unregistered names, including dead-letter queue names passed directly, fail with `JobsQueueUnregistered`. Stored payload decoding failures become `JobsPayloadInvalid`; jobs operation failures become `JobsUnavailable`, carrying the operation name. These declared failures do not expose the original database error.

The `Jobs` module declares no commands, and its bound client has no retry operation. Handler registration performs no jobs read, and a failed jobs request leaves other pages available. The application mounts the registration on its existing RPC host.

#### Mount the Jobs view

Put the page contract in the record of the application's `makeClient` from `@shivaedev/contract/makeClient.ts` and pass its binding and the queues given to `pgBossQueues` to `JobsView`. The view lists failed and dead-lettered jobs with readable failure messages, health, counts, pagination and detail. A caller without `jobs.read` sees a permission refusal. Tailwind applications include `@source "../../node_modules/@shivaedev/admin/src/client/adapters";` in their client CSS.

```tsx
import { JobsView } from "@shivaedev/admin/client/JobsView.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";

const client = makeClient({ jobs: JobsPage.contract });
const { jobs } = client.api;

<JobsView api={jobs} queues={[Mail]} />;
```

For a retry-enabled page, pass `retry={client.runtime.fn(jobs.retry.run)}`. The view offers retry on failed originals; the server also requires `jobs.retry`. Omit both action props for a read-only view. Keep the view inside the application's admin shell and protect its route with `JobsPage.route.permission`.

Queue and schedule labels replace internal names in the queue picker and selected queue heading. A queue's `subject` columns select fields from its masked inspection payload; numbers display as decoded values, and missing fields display `—`. Native `Redacted` fields and sensitive keys remain masked. Failed and dead-lettered jobs use the same subject columns, with dead-letter copies under their source queue's tab rather than separate queue choices. String-only queue lists remain supported and show internal names without subject columns. `defineQueue` checks subject field names against its payload Schema; browser-safe declarations can use `SubjectColumn<typeof PayloadSchema>` from `@shivaedev/jobs/display.ts` to check columns before sharing them with the server.

## Declare retry explicitly

Use `JobsPageWithRetry` from `@shivaedev/admin/jobs/PageWithRetry.ts` and its module `JobsWithRetry` from `@shivaedev/admin/JobsWithRetry.ts` when administrators should be able to retry failed original jobs:

```ts
import { JobsWithRetry } from "@shivaedev/admin/JobsWithRetry.ts";
import { JobsPageWithRetry } from "@shivaedev/admin/jobs/PageWithRetry.ts";

const registration = registerAdmin(adminRegistry(JobsPageWithRetry), { jobs: JobsWithRetry });
const handlers = registration.handlers.pipe(Layer.provide(pgBossQueues(JobsService, Mail)));
```

This variant adds `admin.jobs.retry`, taking `{ queue, id }` and returning void. It requires `ReadJobs` (`jobs.read`) through the page middleware and `RetryJobs` (`jobs.retry`) from `@shivaedev/admin/permissions.ts` in the operation. A caller with only `jobs.read` receives `Forbidden` and the job stays failed. The operation uses the jobs package's existing retry for a failed job in a declared queue. Missing jobs and jobs in other states fail with `JobsNotFailed` from `@shivaedev/admin/jobs/NotFailed.ts`; unregistered queue names, including dead-letter queues, fail with `JobsQueueUnregistered`. A dead-letter copy's id cannot retry its original.

A successful bound retry invalidates health, the affected queue's counts and both listings, and the original job's detail. Health retains the runtime monitor's refresh timing.

### Run a schedule now

The retry-enabled page also exposes `admin.jobs.runScheduleNow`, taking `{ queue }` and returning `Option<string>` with the enqueued run ID. Declare a schedule as `{ name, label?, scheduleOptions?: { key? } }` without a payload Schema, or pass its `defineSchedule` definition. The operation calls the jobs service's `runScheduleNow` and requires the same `ReadJobs` and `RetryJobs` permissions as retry. It rejects queues and schedules not passed to `pgBossQueues` with `JobsQueueUnregistered`. The schedule's normal handler processes the run and its timetable stays unchanged.

Pass the schedule declarations and bound action to show **Run now** for a selected schedule:

```tsx
<JobsView api={jobs} queues={[Mail, Cleanup]} schedules={[Cleanup]} runScheduleNow={Client.runtime.fn(jobs.runScheduleNow.run)} />;
```

### Built-in Users page

Add `UsersPage` from `@shivaedev/admin/users/Page.ts` to the same registry as Jobs and register `users: Users`, with `Users` from `@shivaedev/admin/Users.ts`, the module behind the page, which is server code. The module requires identity's `UserDirectory` service. Provide `betterAuthUserDirectory(AppAuth)` from `@shivaedev/identity/server/better-auth/userDirectory.ts`, with the application's auth declaration that `betterAuthMount` also reads. Identity owns the PostgreSQL reads and role writes, including custom auth mappings. For example, `user.modelName: "users"` in the declaration's options makes the Users view open and page through `users`; mapped name, email, role and creation-time columns are used as well. The page reads identity's exported `userKeys.list` collection, so role changes refresh open user lists.

Each user stores one role string accepted by `AppAccess.Role`. Each role declares an explicit permission list in application code. The Users area assigns roles; it does not edit their grants.

Put the page's contract in the record of the application's `makeClient`, then mount the view in the application's admin shell. Tailwind applications include `@source "../../node_modules/@shivaedev/admin/src/client/adapters";` in `src/client/entry.css`:

```tsx
import { UsersView } from "@shivaedev/admin/client/UsersView.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";

const client = makeClient({ users: UsersPage.contract });
const { users } = client.api;
const changeRole = client.runtime.fn(users.changeRole.run);

<UsersView roles={AppAccess.Role.literals} list={users.list.query} changeRole={changeRole} />;
```

`admin.users.list` takes `{ limit, cursor? }` (1–100 users) and returns `{ users, next, canChangeRoles }` ordered by user id. Each user has id, name, email, role and a UTC sign-up time. The page's operations and generated subscription require `ReadUsers` (`users.read`), enforced by `UsersPermission`. Registration installs this middleware using `SessionPolicy`.

`admin.users.changeRole` takes `{ userId, role }` with the role as a string, since one page serves every application. The user directory refuses a role the application does not declare with `AuthUnavailable`, before anything is written, so the role set passed to `betterAuthUserDirectory` decides which roles exist. The operation also requires `AssignRoles` (`roles.assign`) from `@shivaedev/identity/roles.ts`. The view shows a role select only to callers with that permission. Role writes use identity’s `assignRole` verb, serialize in a transaction and return `LastRoleAssigner` (from `@shivaedev/identity/roles.ts`) if replacing the final holder's role would remove `roles.assign`, regardless of the role's name. A missing user returns `NotFound`. Changes invalidate the list after commit and emit an Effect log with actor id, target id, role and timestamp.

Applications can call `listUsers(input)` and `changeUserRole(input)` from `@shivaedev/admin/server/users.ts` on the server. Both require `UserDirectory` from the Effect environment. These enforce their respective domain permissions using `SessionUser`. Identity resolves the caller's stored role through the session policy.

Keep Better Auth cookie caching disabled so requests see current permissions. Route role writes through `UserDirectory.assignRole` to retain the final-assigner policy. Keep Better Auth's `/admin/set-role`, `/admin/update-user` and `/admin/create-user` browser endpoints disabled because they write roles outside that policy. Better Auth's server-side APIs stay available for trusted code such as a bootstrap command.

### Built-in Sessions page

Add `SessionsPage` from `@shivaedev/admin/sessions/Page.ts` to the admin registry and register `sessions: Sessions`, with `Sessions` from `@shivaedev/identity/Sessions.ts`. Registration installs this middleware using `SessionPolicy`. The page uses identity's `identity.sessions` contract and `sessions.manage` permission.

```tsx
import { SessionsView } from "@shivaedev/admin/client/SessionsView.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";

const { sessions } = makeClient({ sessions: SessionsPage.contract }).api;

<SessionsView currentSessionId={currentSession.id} list={sessions.list.query} revoke={sessions.revoke} onCurrentSessionRevoked={signOut} />;
```

The view lists signed-in sessions with the user's name and email, started, last activity and expiry times. It marks the supplied current session id and asks for confirmation in the page before revoking. A successful revoke refreshes the bound list. Revoking the current session calls `onCurrentSessionRevoked`; the application uses that callback to clear its auth state and navigate to sign-in. The starter mounts this page at `/admin/sessions` and connects the callback to its sign-out flow.

### Dates in the built-in views

The Users, Sessions and Jobs views show each time as a date and a time with seconds and the zone's short name, such as `20 Oct 2026, 14:34:56 CEST`, in the browser's locale and time zone. Pass `locale` and `timeZone` to a view to use the viewer's own instead, such as the values the application reads from identity's `AccountPreferences`. Admin does not read those preferences itself:

```tsx
<UsersView
	roles={AppAccess.Role.literals}
	list={users.list.query}
	changeRole={changeRole}
	locale={preferences.locale}
	timeZone={preferences.timezone}
/>;
```

`locale` is a BCP 47 language tag and `timeZone` an IANA zone name; `SessionsView` and `JobsView` take the same two props. When the browser's `Intl` cannot read one of them, the view falls back to the browser's locale and time zone. Every time is a `<time>` element whose `dateTime` attribute keeps the UTC instant in ISO form.

### Client permission routes

`adminPage` requires a permission middleware, including for custom pages. It applies that middleware to the whole contract and exposes its permission as `page.route.permission`, and registration applies the same middleware to every RPC of the page's module, including its generated subscription. Queries need no repeated page-grant policy. A module query's own read policy can restrict access further. Bound live queries use the same page grant as one-off reads. Set the React route's `staticData.permission` to that value. Use `permissionGuard` from `@shivaedev/react/adapters/permissionGuard.ts` in protected routes' `beforeLoad` and wrap the router in `PermissionBoundary` from `@shivaedev/react/adapters/permissionBoundary.ts` with the session and one application fallback.

### Install and limits

Install `@shivaedev/admin` with its required `effect` peer. Registry, contract and guard consumers need no React stack. To use the optional default views, also install the optional peers `react`, `@effect/atom-react` and `@shivaedev/react`. The package has no root entry; import the module that defines the name.

Page declarations and the registry are browser-safe and add no transport. Server registration lives under `/server`, and modules built with `defineModule`, such as `Users.ts`, are server code whose browser contracts are in `/generated`. The package's build writes `src/generated` and `dist/generated` before compiling, so the published archive holds them although the repository does not commit them. The optional default Jobs, Users and Sessions views under `/client/adapters` use React. Applications own route composition and styling.

This package declares the permission middleware and does not resolve sessions. `permissionLayer` from `@shivaedev/identity/server/permissionLayer.ts` resolves each request's session through the session policy the application supplies, then checks the page's permission.
