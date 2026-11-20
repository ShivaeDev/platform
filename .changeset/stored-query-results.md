---
"@shivaedev/react": minor
"@shivaedev/contract": minor
"@shivaedev/create-app": minor
"@shivaedev/identity": minor
---

### Added

- `@shivaedev/react`: `SessionBoundary` takes `persist`, a storage Layer such as `browserQueryStorage`. Every result retention keeps is written to the device for the user `identify` names, within a second of settling and at once when the page hides, bounded by `queryRetention.capacity` and `queryRetention.storedBytes` (about 5 MB by default). The next generation for that user reads them before its first screen, so a reload shows the last results at once, marked `stale` and `refreshing` like retained ones, and a route loader commits without waiting. The boundary wipes stored results when the session ends or comes back signed out, and the previous user's when another user signs in. The person's data then rests on the device, readable by anyone using that browser profile.
- `@shivaedev/contract`: `QueryStorage` and `QueryStorageProvider` in `QueryStorage.ts`, the port for query results that outlive the page, and `browserQueryStorage` in `adapters/browserQueryStorage.ts`, its IndexedDB Layer. Results are encoded with each operation's success schema; a result whose schema marks a field sensitive is never written, and an entry is deleted when its query answers `QueryReadDenied` or `NotFound` or no longer decodes. `queryRetention` takes `storedBytes`.
- `@shivaedev/react`: a sign-out through `SessionBoundary`'s `signOut` action wipes the stored results as soon as the request succeeds, and the remembered session too when `persist` also supplies the session memory, such as `Layer.merge(browserSessionMemory, browserQueryStorage)`.
- `@shivaedev/identity`: `forgetSession` also wipes the stored query results when its Layer supplies contract's `QueryStorageProvider`, so a signed-out answer, another user, a passed expiry and `session.signOut` clear them with the memory.
- `@shivaedev/create-app`: generated apps keep the remembered session and the stored query results in one `deviceStorage` Layer, passed to `authSession`'s `remember` and to `SessionBoundary`'s `persist`, and the notes list marks itself `aria-busy` while it updates.

### Fixed

- `@shivaedev/contract`: a route loader resolves at once from a bound query's retained value. A query bound by `makeClient` kept its retained flag on signals that `loadQuery` never read, so the loader waited for the revalidation.
