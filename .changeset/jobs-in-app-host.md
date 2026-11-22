---
"@shivaedev/jobs": minor
"@shivaedev/server": minor
"@shivaedev/sql": minor
---

### Added

- `@shivaedev/jobs`: a jobs Layer logs `Worker ready to take jobs` once its workers fetch: at startup without `WorkerRelease`, and the first time its release owns the database with it. Pausing and resuming for a release logs no second line, a Layer with only queue definitions logs none, and Layers that share one client log it once between them: it is logged once per client, whichever host builds the Layer.
- `@shivaedev/server`: `appDatabase`, and so `appHost` and `workerHost`, provides `WorkerRelease` whenever `migrations.release` is given, in every migration mode instead of only in `"wait"`. A web process that runs its jobs Layer in `appHost`'s `services` and passes its release pauses those workers once another process records a newer release, while its HTTP keeps answering, and its readiness line comes from the jobs Layer inside the host's redaction and export.
- `@shivaedev/sql`: `WorkerRelease` gains `awaitRegistration()`, which completes once a first worker control has registered.
- `@shivaedev/sql`: when its first check after a worker registers finds another release, or none, recorded, worker release coordination logs `Workers wait for database release <release> to be recorded` once at warning level, annotated with `recordedRelease`. A host given a release that its migration step never recorded, such as one in `"check"` mode, no longer holds its workers back without a word.

### Breaking

- `@shivaedev/server`: `Worker ready to take jobs` now means "this process fetches jobs", not "this process has started". `workerHost` no longer writes it; its jobs Layers do, once their workers fetch. A `workerHost` user sees three differences: with a release, the line comes when the workers first take the release, after the old release's workers have drained, instead of when the host finishes building; a worker host with no queue workers logs no line; and a process whose jobs Layers use two separate clients logs two lines. A deployment check or test kit that waits for the line to learn that a worker process started waits for that drain, or forever when its release never takes the database. To migrate, give the worker process a start signal of its own and wait on that for "started", as the starter's deployment kit now does: `src/test-support/deployApplication.ts` writes `started` to file descriptor 3 once the worker Layer is built, `src/test-support/deployChild.ts` resolves `ready` from it and `takingJobs` from the line, and `src/test-support/deploymentProcesses.ts` waits on `takingJobs` only where a story is about readiness. A generated application takes these files with `create-app update`.

### Changed

- `@shivaedev/sql`: `coordinateWorkerRelease` claims a process row only after a worker control registers, claiming at once when the first one does, and writes heartbeats and removes the row only while it holds one. A process without workers, such as a web host given a release, never holds back another release's takeover.
