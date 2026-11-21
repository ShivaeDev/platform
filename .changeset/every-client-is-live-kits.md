---
"@shivaedev/test-kits": minor
"@shivaedev/contract": patch
"@shivaedev/react": patch
"@shivaedev/test-story": minor
---

### Added

- `@shivaedev/test-kits`: `layerLiveMemoryProtocol(group, handlers)` and `liveHost(group, handlers)` from `@shivaedev/test-kits/contract/liveMemoryProtocol.ts` serve a module's queries and commands in-process as a live host, with its change stream, command guard and live sync, so a story's client runs live as it does against the application host. Pass one `liveChannel()` to several `liveHost` calls when their transports must share one change channel.
- `@shivaedev/test-story`: each `MemberScreen` from `memberScreens` carries a `cookie` header value built from the member's seeded cookies, so a client that opens a socket can sign in as that member.

### Fixed

- `@shivaedev/contract`: a live query that failed and is refreshed or retried shows its failure as waiting while its subscription reopens, instead of a settled failure.
- `@shivaedev/react`: a live query's `Unauthorized` failure asks the session's auth owner to recheck once. It reached the screen through the query's result and through the live status, and a recheck that returned at once ran twice.
