---
"@shivaedev/admin": minor
"@shivaedev/contract": patch
"@shivaedev/server": patch
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/admin`: `registerAdmin` takes each page's defined module by page id instead of a handler Layer, and serves the page from that module under the page's permission, so the host takes an admin query's live keys and an admin command's `invalidates` from the module rather than from the generated browser contract. In the starter's notes statistics registration, `registerAdmin(Admin, { "note-statistics": moduleHandlers(Statistics) })` becomes `registerAdmin(Admin, { "note-statistics": Statistics })`, and the `moduleHandlers` import goes. The built-in pages register the same way: `jobs: Jobs`, `users: Users` and `sessions: Sessions`.
- `@shivaedev/admin`: a page's operations reach the host only through its module, so a page over a hand-written `contract(...)` no longer registers. Before, a page declared `const Totals = query("totals", { readPolicy, reads: () => [reports.list], success: Schema.Number })` and `adminPage({ contract: contract("admin.reports", { queries: [Totals] }), id: "reports", ... })` in browser code, and the server registered `registerAdmin(Admin, { reports: ReportsPage.contract.application.toLayer({ "admin.reports.totals": () => totals }) })`. After, a server file declares `const Totals = query("totals", { readPolicy, reads: () => [reports.list], *run() { return yield* totals } })` and `export const Reports = defineModule({ name: "admin.reports", operations: [Totals], wire: adminReportsWire })`, `pnpm generate` writes the browser contract `Reports`, the browser page takes `adminPage({ contract: Reports, id: "reports", ... })` from the generated file, and the server registers `registerAdmin(Admin, { reports: Reports })` with the module. Each operation's handler moves from the `toLayer` record into its own `run`. A module must serve exactly its page's operations, so a retry-enabled jobs module cannot serve the read-only jobs page; TypeScript refuses the mismatch and the handler Layer defects on it with `Admin page <id> is served by a module whose operations differ from the page's`. The defects for a missing or extra page now read `Missing admin module: <id>` and `Unregistered admin module: <id>`.
- `@shivaedev/admin`: `adminRegistry(...pages)` returns only `pages`, because the served group now comes from the server modules. Browser code that read `Admin.group` merges the pages' contracts instead, `RpcGroup.make().merge(...Admin.pages.map((page) => page.contract))`, or passes each page's contract to `makeClient`, as in `makeClient({ statistics: StatisticsPage.contract })`. Only server code reads `registration.group` from `registerAdmin` or `mergeAdminRegistrations`; importing the registration into browser code pulls the server modules into the browser bundle.
- `@shivaedev/admin`: `adminPage` applies the page's permission to the browser contract and no longer adds a read policy to its queries, so `page.contract`'s queries keep the contract's own types. The page grant still guards every operation and the generated subscription through the permission middleware, and a module query's own read policy still restricts access further.

### Changed

- `@shivaedev/server`: an `admin` field on an application module is the result of `registerAdmin` or `mergeAdminRegistrations`, which carries the `group` the host serves.
- `@shivaedev/create-app`: the starter's notes statistics and foundation admin registrations pass their modules to `registerAdmin`.

### Fixed

- `@shivaedev/contract`: a defined module's query that reads collections under a `permissionReadPolicy` opens its live subscription through `moduleHandlers`; the handler's copy of the policy now keeps the permission mark that collection reads require, where the subscription was refused with `QueryReadDenied`.
