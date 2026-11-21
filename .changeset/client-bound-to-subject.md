---
"@shivaedev/contract": minor
---

### Added

- `forSubject(client, subject)` from `@shivaedev/contract/forSubject.ts` returns a client's `api`, one contract's client or any record of them with every query's, command's and stream's subject defaulted to `subject`, so a screen tree that acts for another account binds its client once instead of passing `{ subject }` on every call. A subject named on a call still wins. Anything else, such as the value `makeClient` returns, is a compile error. A query through the bound client is the same atom, with the same serialization and live-update keys, as the query that names the subject per call, and binding the same client to the same subject again returns the same operations, so React's action and form hooks send the subject with no change in the screen.
