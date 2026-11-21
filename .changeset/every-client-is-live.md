---
"@shivaedev/contract": minor
"@shivaedev/react": minor
"@shivaedev/admin": patch
---

### Breaking

- `@shivaedev/contract`: every bound query subscribes to the server's changes. `bind` and `makeClient` no longer take `live`; delete `live: false` from their options. Over HTTP a bound operation's `run` still makes one call, and a bound query's atom fails with `WebSocketRequired`, so serve a screen's queries over the WebSocket client from `makeClient`.
- `@shivaedev/contract`: the browser no longer refreshes queries itself. A successful command no longer invalidates its declared keys or its contract's key in the client's `Reactivity`, so an atom that listened there for a command's keys no longer reruns; read the query through a binding, whose subscription receives the server's new result.
- `@shivaedev/contract`: `@shivaedev/contract/clientKeys.ts` is removed, with `clientReadKeys`, `clientInvalidationKeys` and `KeyContext`. Delete their imports; the server's keys from `@shivaedev/changes/keys.ts` are the only keys.
- `@shivaedev/contract`: `queryProgress()` from `@shivaedev/contract/queryProgress.ts`, the `keyContext` and `retryKeys` options of `live()` from `@shivaedev/contract/live.ts`, and the positional `enabled` parameter of `automaticLive` from `@shivaedev/contract/automaticLive.ts` are removed. Delete them where you pass or call them; nothing replaces them.
- `@shivaedev/react`: `usePendingCommand` no longer takes `queries`. Delete the option: the hold already lasts until the command is reflected, which every query the command changed now shows.

### Changed

- `@shivaedev/contract`: a live subscription that failed with something other than `QueryReadDenied` reopens after the client's next reflected command, whatever keys that command declares. It used to reopen on a matching key the browser invalidated.
- `@shivaedev/admin`: the Users page's role change declares no invalidation of its own; the user directory's role assignment announces the changed user, which reruns the users list.
