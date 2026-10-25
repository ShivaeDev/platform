# @shivaedev/admin

Admin tooling starts with an explicit list of pages and the operations each page needs. This package collects native Effect contracts behind the administrator role, so every page operation shares the same boundary.

## Declare the tools operators can use

```ts
const Jobs = adminPage({
  id: "jobs",
  route: { path: "/admin/jobs", title: "Jobs" },
  contract: contract("admin.jobs", { queries: [Failed] }),
});
const Admin = adminRegistry(Jobs);
```

The page exposes `admin.jobs.failed` and the generated `admin.jobs.$changes` subscription. Both require `AuthenticatedAdmin`. A query-only contract has no command; an owner without the `admin` role remains forbidden.

## Use native contracts and Layers

Install `@shivaedev/admin` with `effect`. Declare each page's queries, commands and streams with `@shivaedev/effect-contract`, then pass its native contract to `adminPage`. The stable id identifies the page at server registration; route metadata belongs to the application's view. Author RPC namespaces in the contract name, such as `admin.jobs`.

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
import { authenticatedAdminLayer } from "@shivaedev/platform/server/rpc-server/roles.ts";

const registration = registerAdmin(Admin, {
  jobs: Jobs.contract.application.toLayer({
    "admin.jobs.failed": () => Effect.succeed(["mail-42"]),
  }),
});
const handlers = registration.handlers.pipe(
  Layer.provideMerge(authenticatedAdminLayer(sessions)),
);
```

Pass `registration.group` and `handlers` to the existing application's RPC host on `/rpc`, merging them with its other groups and Layers as needed. The Platform host supplies generated change handlers; registration requires the page's application handlers. Handler Layer errors and service requirements remain inferred. Missing or extra page ids fail at registration; TypeScript also checks each Layer provides the handlers for its page.

Page declarations and the registry are browser-safe. Server registration lives under `/server`; views belong in the application. This package ships no UI components and adds no transport. The package's stories prove role enforcement through native in-process RPC, with an already resolved session as a precondition.
