---
"@shivaedev/server": minor
"@shivaedev/email": patch
"@shivaedev/build": patch
---

### Added

- `@shivaedev/server`: `AppModule` takes a third form for a registration that serves no RPCs, with no `group`, `handlers` or `module`. It carries any of `admin`, `ports`, `queues`, `workers`, `migrations`, `requestServices` and `services` and an optional `name`, so a registration with only admin pages, queues or workers writes `{ admin } satisfies AppModule` instead of `group: RpcGroup.make(), handlers: Layer.empty, name: "…"`.
- `@shivaedev/server`: `services` is optional in every form of `AppModule`, and a registration without it composes as `Layer.empty`. `appModules` still refuses a defined module whose operations yield a service no registration provides.

### Breaking

- `@shivaedev/server`: `DuplicateModuleQueue`'s `firstModule` and `secondModule` are `undefined` for a registration without a name, and the new `firstAdminPage` and `secondAdminPage` hold such a registration's first admin page id. Its message names that registration by the page, or says it has no name and to give it one. Code that reads `firstModule` or `secondModule` as a `string` handles `undefined`, or reads the message.

### Changed

- `@shivaedev/email`: `authEmailQueue`'s `registration` no longer writes an empty RPC group, empty handlers or a name; it carries only its queue, producer services and worker.
- `@shivaedev/build`: `generate` lists a registration that serves no RPCs, such as `{ admin } satisfies AppModule`, in the server's module list, and refuses an exported object without `satisfies AppModule` that names `group` and `handlers`, or names `module` by reference beside another registration part or under a `server` folder, whether or not it names `services`.
