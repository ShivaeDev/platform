---
"@shivaedev/react": minor
"@shivaedev/build": minor
"@shivaedev/create-app": minor
"@shivaedev/quality": patch
---

### Added

- `@shivaedev/react`: `clientModule(contracts, (clients) => parts)` from `@shivaedev/react/client/module.ts` names the contracts a module's screens call, once, under the module's own names, and hands the callback a typed bound client for each; its parts are `routes: (root) => [...]`, `warm`, `admin`, `menu`, `overlays` and `footer`. Module routes get a typed root through the `Register` interface, which the application augments once with `{ readonly root: ReturnType<typeof rootRoute> }`. `AdminNavigation` describes an admin page for navigation by its shape.
- `@shivaedev/react`: `clientApp(modules, options?)` from `@shivaedev/react/client/app.ts` makes one client over every module's contracts with `makeClient`, binding a contract that two modules name once, and returns `connect` and `warm` that spread into `SessionBoundary`. The connection carries `routes(root)`, `adminPages`, `modules` and the client's activity, `runtime` and `sync`; `options` takes `url`, `protocol`, `headers` and the other client options for story kits and native shells.
- `@shivaedev/build`: `shivaedev-build generate` also writes the client's module list to `src/generated/client/modules.ts`: every exported `clientModule(...)` call, with `clientModule` imported from `@shivaedev/react/client/module.ts` by name or through a namespace, one import each, in the order of their files' paths. Test files and `test-support` folders are left out, and an exported `clientModule(...)` under a `server` folder, or a module's `client/module.tsx` that exports no client module, stops `generate` with the file and the fix. The dev server's plugin writes the list again when a client module file appears or changes.
- `@shivaedev/create-app`: `create-app resource <name>` also writes `client/module.tsx`, a client module that names the resource's generated contract and adds a signed-in `/<name>` route listing the account's items, with a screen story and its kit that open the route in the real app.

### Fixed

- `@shivaedev/quality`: `files/named-after-export` now accepts a file whose one export is a `clientModule(...)` from `@shivaedev/react/client/module.ts`, such as `src/modules/notes/client/module.tsx` exporting `notesModule`, whose name repeats the `modules` folder, as it accepts an operation file.

### Breaking

- `@shivaedev/create-app`: generated apps list their client modules by folder. A module's client is one `client/module.tsx` that exports `clientModule(...)`; `src/client/modules.ts` is `export const clientModules = clientApp(modules)` over `#generated/client/modules.ts`, which includes the foundation's `src/client/admin/foundationModule.tsx`; `SessionApp` and `App` take that `app` in place of `connect`; `appRouter` is a plain function of `{ auth, connection, history, onAuthenticated, registry, session }`; and `src/client/Module.ts`, `src/client/AdminNavigation.ts`, `src/client/adapters/SessionConnectionBoundary.tsx`, `useAnonymousConnection.ts` and `useAppRouter.ts` are gone. To migrate a module, replace its `client/registration.tsx` with one `client/module.tsx` exporting `clientModule({ notes: Notes }, ({ notes }) => ({ routes: (root) => [...], warm }))`, and its admin registration with `client/admin/module.tsx` exporting `clientModule({ statistics: StatisticsPage.contract }, ({ statistics }) => ({ admin, routes: (root) => [...] }))`, so the admin fence keeps admin views out of member code: routes take `getParentRoute: () => root` and reach the clients by closure, and the registration's `api`, `bindings` and its Effect, registry and URL go. Then delete the module from the hand-written list in `src/client/modules.ts` and run `pnpm generate`. Import `AdminNavigation` from `@shivaedev/react/client/module.ts`, and move the `fullScreen` static-data declaration next to `Shell.tsx`. `create-app update` replaces the starter's files the app never edited and leaves conflict markers where it did.
