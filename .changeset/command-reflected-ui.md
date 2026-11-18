---
"@shivaedev/react": minor
"@shivaedev/test-story": minor
"@shivaedev/contract": minor
"@shivaedev/skills": patch
---

### Added

- `@shivaedev/test-story`: A screen driver has a `sync` option and a `sync()` verb for a write the screen's client did not make. The verb runs the supplied Effect inside the renderer's `act`, then settles the screen, so the next readout shows every change committed before it. Without the option it fails with `MissingScreenSync` from `@shivaedev/test-story/server/screenDriver.ts`.
- `@shivaedev/contract`: `screenSync(client, registry)` from `@shivaedev/contract/screenSync.ts` runs a client's `sync` through a view's registry, for the driver's `sync` option.

### Changed

- `@shivaedev/skills`: The story-testing skill says that `settle()` waits until the story's own commands are reflected, and that a kit waits for someone else's write with the driver's `sync()`. It no longer mentions `withLiveAnswer`.

### Breaking

- `@shivaedev/react`: `usePendingCommand` holds the requested value until the command is reflected, when every live query open on the connection shows the server's state after it, in place of waiting for a watched query's next result. A command that changes nothing now frees its control. The hook takes the bound command and its client's runtime where it took an action atom: change `usePendingCommand(toggle(row.id), { queries: [list], value, wanted })`, with `toggle` an `Atom.family` of `ItemsClient.runtime.fn(...)`, to `usePendingCommand({ ...api.toggle, runtime: ItemsClient.runtime }, { value, wanted })`, pass the row's id in the dispatched input and delete the family. `queries` is optional: keep it, as an array with a stable identity, only for queries the client reloads itself, such as those of a `live: false` client. `result`, `data` and `cause` now settle when the command is reflected.
- `@shivaedev/test-story`: The screen driver's `withLiveAnswer`, `LiveAnswerSignal` from `server/LiveAnswerSignal.ts` and `nextLiveAnswer` are removed. After the story's own command, call `settle()`: with `activityScreenSignal(clientActivity(client))` as the driver's `activity` it returns once the command is reflected. After a write the client did not make, pass `sync: screenSync(client, view.registry)` to the driver and call `sync()`. A verb such as `screen.withLiveAnswer(liveAnswers(view.registry, "the notes list", api.list.query()), screen.submit())` becomes `screen.submit()` followed by `screen.settle()`. Both waits need a host that confirms commands. The application host does. Against a hand-built native host that confirms nothing, a command still counts as reflected at its reply; give such a host the command guard and the sync command, as the starter's `src/modules/notes/test-support/clientHost.ts` does.
- `@shivaedev/contract`: `liveAnswers` from `@shivaedev/contract/liveAnswers.ts` is removed with the wait it fed. Use the screen driver's `settle()` and `sync()` as above, or `untilReflected` and the client's `sync` outside a screen.
