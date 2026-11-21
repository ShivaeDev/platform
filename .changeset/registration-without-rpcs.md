---
"@shivaedev/server": minor
"@shivaedev/email": minor
"@shivaedev/build": patch
---

### Added

- `@shivaedev/server`: `AppModule` takes a third form for a registration that serves no RPCs, with no `group`, `handlers` or `module`. It carries any of `admin`, `ports`, `queues`, `workers`, `migrations`, `requestServices` and `services` and an optional `name`, so a registration with only admin pages, queues or workers writes `{ admin } satisfies AppModule` instead of `group: RpcGroup.make(), handlers: Layer.empty, name: "…"`.
- `@shivaedev/server`: `services` is optional in every form of `AppModule`, and a registration without it composes as `Layer.empty`. `appModules` still refuses a defined module whose operations yield a service no registration provides.

### Breaking

- `@shivaedev/server`: `DuplicateModuleQueue`'s `firstModule` and `secondModule` are `undefined` for a registration without a name, and the new `firstAdminPage` and `secondAdminPage` hold such a registration's first admin page id; they stay `undefined` for a named registration. Its message names that registration by the page, or says it has no name and to give it one. Code that reads `firstModule` or `secondModule` as a `string` handles `undefined`, or reads the message.
- `@shivaedev/email`: `authEmailQueue`'s `registration` no longer has `group`, `handlers` or `name`; it carries only its queue, producer services and worker. It needs the `@shivaedev/server` version that ships the third `AppModule` form: an older `AppModule` refuses it in `satisfies AppModule` and `appModules([...])`. Code that read `registration.name` reads `authEmailJobs.name` from `@shivaedev/email/authEmailJobs.ts`, which holds the same value.

### Changed

- `@shivaedev/build`: `generate` lists a registration that serves no RPCs, such as `{ admin } satisfies AppModule`, in the server's module list, and refuses an exported object without `satisfies AppModule` that names `group` and `handlers`, names `module` beside another registration part such as `services` or `migrations`, or names a module by reference alone under a `server` folder.
