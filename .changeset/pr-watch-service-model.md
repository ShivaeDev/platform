---
"@shivaedev/pr-watch": minor
---

### Breaking

- Rename operation imports beneath `GitHub/`, `GitHubHttp/`, `StateFile/` and `Watcher/` to `github/`, `github-http/`, `state-file/` and `watcher/`, respectively.
- Import `Watcher`, `GitHub`, `GitHubHttp` and `StateFile` from `watcher/service.ts`, `github/service.ts`, `github-http/service.ts` and `state-file/service.ts` under `@shivaedev/pr-watch`, respectively, instead of the former root modules. Replace `watcher.poll(options, previous, emit, diagnostic)` with `poll(options, previous, emit, diagnostic)` imported from `@shivaedev/pr-watch/watcher/poll.ts`, and provide `watcherLayer` to that Effect. Callback failures and requirements remain typed. `watch` and `program` keep their existing signatures.
- Watcher no longer initializes dependency-capturing operations. Its `targets`, `observe` and `save` operations yield dependencies bound by its Layer; `watcherLayer` continues to provide the complete engine.
- Replace direct uses of `Watcher/initialize.ts` and `WatcherState` with `Watcher.layer`. The `observe` and `targets` modules export direct operations instead of Effects that construct functions; use `yield* Watcher` and call its corresponding methods. The `commit` module also exports a direct operation; callers composing rounds should use `poll`.
