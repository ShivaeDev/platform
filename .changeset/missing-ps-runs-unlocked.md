---
"@shivaedev/heavy-lock": patch
---

### Changed

- When `ps` is not on the `PATH`, `heavy-lock` and `withHeavyLock` run the command without the lock instead of failing with "Could not run ps to read this process's start time.", and print `heavy-process lock: ps is not on the PATH, so this command runs without the lock.` to stderr. As under CI, `HeldLock.env` carries no owner ID and another holder's lock is left alone. A `ps` that runs but prints no start time still fails acquisition. Builds in slim container images without `ps` no longer need `CI` set to run.
