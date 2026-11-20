---
"@shivaedev/react": minor
"@shivaedev/contract": minor
"@shivaedev/create-app": minor
---

### Added

- `@shivaedev/react`: `SessionBoundary` takes `warm`, a function of the session's client that returns bound query atoms, such as `warm={(client) => [client.water.day.query({ date }), client.notes.list.query()]}`. Each listed query is mounted in the session's registry when the generation commits and stays subscribed until sign-out, another user or unmount, so a screen that reads it later renders its current value in its first render, also after a long idle stretch. The list is read again on every render and compared by atom identity: a changed payload opens the new query and hands the old one to retention. A warm query that no screen reads does not hold back `useFirstSettled`. Each listed query holds one subscription on the host for the whole session. Delete components that only mounted queries to keep them warm and list those queries instead.
- `@shivaedev/contract`: `warmQueries` in `warmQueries.ts`, a registry atom naming the queries a session keeps mounted. A query listed there when it mounts does not hold back the client activity's `firstSettled` flag while it awaits its first result; it still counts in `initialQueries`.
- `@shivaedev/create-app`: generated apps' client modules take an optional `warm` array of bound queries that `SessionApp` keeps subscribed for the session; the notes module lists its notes list.
