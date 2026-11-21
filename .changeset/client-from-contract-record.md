---
"@shivaedev/contract": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/contract`: `makeClient` takes a record of contracts and moves to `@shivaedev/contract/makeClient.ts`. It makes one RPC client over every contract in the record, with one activity and one runtime, and binds each contract under its key in `api`. Wrap the contract in a record and read its binding by that key: `makeClient(Notes, options).api.list` becomes `makeClient({ notes: Notes }, options).api.notes.list`, and the import `import { makeClient } from "@shivaedev/contract/bind.ts"` becomes `import { makeClient } from "@shivaedev/contract/makeClient.ts"`.
- `@shivaedev/contract`: the `group` option of `makeClient` is removed, and so is binding further contracts with `bind` on a made client's `Client`. Put every contract in one record instead: `const client = makeClient(Users, { group: Admin.group, url }); const jobs = bind(Jobs, client.Client)` becomes `const client = makeClient({ jobs: Jobs, users: Users }, { url })`, with `client.api.users` and `client.api.jobs`. `bind` stays for an `AtomRpc.Service` the application builds itself.
- `@shivaedev/contract`: `MadeClient` from `@shivaedev/contract/clientOptions.ts` moves to `@shivaedev/contract/makeClient.ts` and takes the record's type, `MadeClient<typeof contracts>`; `ClientService` is removed. `ClientOptions` moves from `@shivaedev/contract/clientOptions.ts` to `@shivaedev/contract/ClientOptions.ts` and gains `registry`, so `Omit<ClientOptions, "url"> & { readonly registry?: AtomRegistry.AtomRegistry }` becomes `ClientOptions`.

### Added

- `@shivaedev/contract`: `ContractClient<typeof Notes>` from `@shivaedev/contract/makeClient.ts` is the type of a contract's binding in any client whose record holds it, so a screen names its client by the contract alone.
- `@shivaedev/contract`: `makeClient`'s `url` is optional and defaults to `/rpc` beside the page's location, so browser code passes no URL and, without a session-scoped contract, no options.

### Changed

- `@shivaedev/create-app`: `add-resource` no longer writes `client/make.ts`; the resource's story kit makes its clients with `makeClient({ bookmarks: Bookmarks }, options)`.
