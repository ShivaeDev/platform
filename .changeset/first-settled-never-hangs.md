---
"@shivaedev/contract": patch
"@shivaedev/react": patch
---

### Changed

- `@shivaedev/react`: `useFirstSettled(client)` turns `true` once the screen that calls it has rendered and nothing on the client is waiting, so a first screen that reads no query, such as a blank form or a welcome page, is revealed instead of waiting forever. A screen that reads queries is still revealed in one step after they answer. Applications that kept such screens out of the gate can now gate them.
- `@shivaedev/contract`: the client activity's `firstSettled` flag waits for its new `rendered` Effect, which `useFirstSettled` runs after its first render, instead of a first query answer.
