---
"@shivaedev/quality": minor
"@shivaedev/heavy-lock": minor
---

### Added

- Report swallowed failures with `effect/failure-honesty`: forked forever loops piped through `orDie`, conditional retries without `times` or `schedule`, blanket catches returning success, and FileSystem calls wrapped in `option` or `orElseSucceed`. Findings explain typed recovery alternatives. The rule refuses config exceptions; record reviewed existing debt through first adoption.

### Breaking

- Heavy-lock only treats `NotFound` as an absent holder. Acquisition reports other read failures as `HeavyLockError`, preserving the filesystem cause. Consumers of `lockFile.ts`'s `readHolder` must now handle `PlatformError` in the Effect error channel; callers of `acquireHeavyLock` keep handling `HeavyLockError` and should repair an unreadable lock path instead of waiting for acquisition.
