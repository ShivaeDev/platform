---
"@shivaedev/server": minor
---

### Fixed

- A host built with a deferred `application` Effect that builds its services itself with `Layer.build`, as the starter and every generated app do, now collects the models of those repositories: an operation it serves finds their owned models through `(yield* RepositoryModels).owned`, so identity's account export, erase and coverage check see them, and the fields those models mark sensitive or server-only are now masked in the host's logs, including logged defects, and its exported traces. From server 0.36.0 until this release, such a host left those fields unmasked, so logs and traces it wrote in that time hold their values in clear.

### Breaking

- Code that composes the host below `appHost` must provide the host's model collector: `hostSensitiveKeys`, `redactedHost`, `appHostHttp`, `migratedHost` and `deferredHost` now require `HostModels` from `@shivaedev/server/HostModels.ts`. Provide `hostModels()` from the same module once around everything the host builds, including a deferred `application` Effect, for example `host.pipe(Layer.provide(hostModels()))`. `hostPreflight` takes a fifth type parameter for the requirements of its policy Effect, so a call that passes its type arguments explicitly adds that one. `appHost` and `workerHost` provide the collector themselves, so their users change nothing.
