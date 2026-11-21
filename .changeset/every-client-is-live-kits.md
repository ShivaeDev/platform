---
"@shivaedev/test-kits": minor
"@shivaedev/contract": patch
"@shivaedev/react": patch
"@shivaedev/test-story": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/server`: `servedGroup(group, websocket)` from `@shivaedev/server/servedGroup.ts` and `servedHandlers(group, handlers, buildVersion?)` from `@shivaedev/server/servedHandlers.ts` are the composition `appHost` serves its RPC group with: the read policy guard, which refuses `$changes` over HTTP, the command guard, the change stream, the host version and live sync. A native RPC host uses them to serve as `appHost` does.
- `@shivaedev/test-kits`: `layerLiveMemoryProtocol(group, handlers)` and `liveHost(group, handlers, { protocol })` from `@shivaedev/test-kits/contract/liveMemoryProtocol.ts` serve a module's queries and commands as a live host through server's `servedGroup` and `servedHandlers`, so a story's client runs live as it does against the application host, and a `$changes` subscription over `protocol: "http"` is refused with `WebSocketRequired` as the host refuses it. Pass one `liveChannel()` as `channel` to several `liveHost` calls when their transports must share one change channel.
- `@shivaedev/test-story`: each `MemberScreen` from `memberScreens` carries a `cookie` header value built from the member's seeded cookies, so a client that opens a socket can sign in as that member.

### Fixed

- `@shivaedev/contract`: a live query that failed and is refreshed or retried shows its failure as waiting while its subscription reopens, instead of a settled failure.
- `@shivaedev/react`: a live query's `Unauthorized` failure asks the session's auth owner to recheck once. It reached the screen through the query's result and through the live status, and a recheck that returned at once ran twice.
