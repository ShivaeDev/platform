---
"@shivaedev/changes": minor
"@shivaedev/sql": minor
"@shivaedev/contract": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/contract`: A command run through a client from `makeClient` has three states: `sent`, `accepted` when its reply arrives, and `reflected` when every live query open on the same connection shows the server's state after the command. `untilReflected` from `@shivaedev/contract/commandSignal.ts` completes a command's Effect at `reflected`, and `CommandSignal` from the same module receives each state. A command that publishes nothing is reflected without waiting for an update, and a failed command leaves nothing to wait for. Work a command starts for later, such as a job, is not covered.
- `@shivaedev/contract`: `sync` on the value `makeClient` returns waits the same way without writing anything, so a client can wait for a write it did not make. It sends the `platform.liveSync.request` command of `LiveSync` from `@shivaedev/contract/LiveSync.ts`.
- `@shivaedev/contract`: Client activity has an `unreflectedCommands` count, which holds a command from the moment it is sent until it is reflected or fails.
- `@shivaedev/contract`: `LiveServer` and `makeLiveServer` have `synced(token)`, which queues a sync token in the subscriptions of the client it names, and `register` and `stream` take that client's name. A `$changes` request that names its client in the `x-shivaedev-sync` header receives `Syncing` and `Synced` frames; other requests receive the same frames as before.
- `@shivaedev/changes`: `CommandPublication.publish(keys, sync)` takes the command's sync token, a `SyncToken` from `@shivaedev/changes/syncToken.ts`, and delivers it behind the keys. The default publisher hands it to the `SyncDelivery` reference from the same module.
- `@shivaedev/sql`: The command publisher of `postgresChanges` sends a command's sync token through NOTIFY on the change channel behind the command's keys, and every listening host passes each token to its `synced` function in channel order.
- `@shivaedev/server`: Hosts send a command's sync token once its handler has finished, hand the tokens they receive to the live streams of the client each one names, and serve the `platform.liveSync.request` command.

### Breaking

- `@shivaedev/sql`: `postgresChanges` requires a `synced` option. Pass the `synced` function of the live server whose `resync` you already pass: `postgresChanges({ channel, client, resync: live.resync, synced: live.synced })`. Direct users of `listenForChanges` provide `PostgresChangeSync` from `@shivaedev/sql/PostgresChangeSync.ts`. Hosts built with `appDatabase` or `appHost` need no change.
- `@shivaedev/contract`: `isClientSettled` also waits for `unreflectedCommands` to reach zero, so a screen story's `settle()` returns after a command's change is on the screen. Code that builds a `ClientActivityState` by hand adds `unreflectedCommands: 0`.
- `@shivaedev/contract`: The `$changes` stream's success type and `QueryUpdate` include `Syncing` and `Synced`. Code that matches every `QueryUpdate` tag adds the two cases; a consumer that sends no `x-shivaedev-sync` header never receives them.
- `@shivaedev/contract`: The `CommandBoundary` of `commandGuardLayer` receives the command's sync token as a third argument. A custom boundary passes it to `CommandPublication.publish(keys, sync)`.
- `@shivaedev/contract`: A client from `makeClient` also declares the `platform.liveSync.request` command. A custom native RPC host that passes `syncClient` to its subscriptions merges `LiveSync.application` into its group and handles the command with `Effect.void`. A host that does neither needs no change: its clients' commands are reflected as soon as they are accepted.
