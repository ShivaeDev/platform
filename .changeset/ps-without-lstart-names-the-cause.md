---
"@shivaedev/heavy-lock": patch
---

### Changed

- When `ps` runs but prints no start time, such as BusyBox `ps` in Alpine images, `heavy-lock` and `withHeavyLock` fail with "Could not read this process's start time because this ps does not support `ps -o lstart= -p <pid>`, as BusyBox ps in Alpine images does not; install procps, or set CI to run the command without the lock." instead of "Could not read this process's start time from ps.". The command still does not run.
