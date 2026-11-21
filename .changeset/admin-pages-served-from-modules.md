---
"@shivaedev/admin": minor
"@shivaedev/server": patch
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/admin`: `registerAdmin` takes each page's defined module by page id instead of a handler Layer, and serves the page from that module under the page's permission, so the host takes an admin query's live keys and an admin command's `invalidates` from the module rather than from the generated browser contract. In the starter's notes statistics registration, `registerAdmin(Admin, { "note-statistics": moduleHandlers(Statistics) })` becomes `registerAdmin(Admin, { "note-statistics": Statistics })`, and the `moduleHandlers` import goes. The built-in pages register the same way: `jobs: Jobs`, `users: Users` and `sessions: Sessions`.
- `@shivaedev/admin`: a page's operations reach the host only through its module. A page over a hand-written `contract(...)` with handlers from `page.contract.application.toLayer(...)` no longer registers; write its operations as a module with `defineModule`, pass its generated contract to `adminPage` and register the module. A module must serve exactly its page's operations, so a retry-enabled jobs module cannot serve the read-only jobs page; TypeScript refuses the mismatch and the handler Layer defects on it with `Admin page <id> is served by a module whose operations differ from the page's`. The defects for a missing or extra page now read `Missing admin module: <id>` and `Unregistered admin module: <id>`.
- `@shivaedev/admin`: `adminRegistry(...pages)` returns only `pages`; the served `group` comes from `registerAdmin` and `mergeAdminRegistrations`. Read `registration.group` where an application read `Admin.group`.
- `@shivaedev/admin`: `adminPage` applies the page's permission to the browser contract and no longer adds a read policy to its queries, so `page.contract`'s queries keep the contract's own types. The page grant still guards every operation and the generated subscription through the permission middleware, and a module query's own read policy still restricts access further.

### Changed

- `@shivaedev/server`: an `admin` field on an application module is the result of `registerAdmin` or `mergeAdminRegistrations`, which carries the `group` the host serves.
- `@shivaedev/create-app`: the starter's notes statistics and foundation admin registrations pass their modules to `registerAdmin`.
