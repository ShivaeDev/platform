---
"@shivaedev/jobs": minor
"@shivaedev/server": minor
"@shivaedev/sql": minor
---

### Added

- `@shivaedev/jobs`: a jobs Layer logs `Worker ready to take jobs` once its workers fetch: at startup without `WorkerRelease`, and the first time its release owns the database with it. Pausing and resuming for a release logs no second line, a Layer with only queue definitions logs none, and Layers that share one client log it once between them, so every process that runs workers logs it once, whichever host builds it.
- `@shivaedev/server`: `appDatabase`, and so `appHost` and `workerHost`, provides `WorkerRelease` whenever `migrations.release` is given, in every migration mode instead of only in `"wait"`. A web process that runs its jobs Layer in `appHost`'s `services` and passes its release pauses those workers once another process records a newer release, while its HTTP keeps answering, and its readiness line comes from the jobs Layer inside the host's redaction and export.
- `@shivaedev/sql`: `WorkerRelease` gains `awaitRegistration()`, which completes once a first worker control has registered.

### Changed

- `@shivaedev/server`: `workerHost` no longer writes `Worker ready to take jobs` itself; its jobs Layers write it. With a release, the line now comes when the workers first fetch, after the old release's workers have drained, instead of when the Layer finishes building. A deployment check that waits for the line before the old release has drained waits for that drain.
- `@shivaedev/sql`: `coordinateWorkerRelease` claims a process row only after a worker control registers, claiming at once when the first one does, and writes heartbeats and removes the row only while it holds one. A process without workers, such as a web host given a release, never holds back another release's takeover.
