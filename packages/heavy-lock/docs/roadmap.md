# Roadmap

This file owns heavy-lock's implementation, verification gaps and open questions. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns cross-package composition and host-level adoption checks. A source or package test establishes this package's behavior, not coordination on every consumer's machine.

## Built

- [x] A shared holder file with ordered JSON encoding, C-locale process start identity, hard-link acquisition and ID-checked release. The protocol fixture and lock-file tests exercise live, dead, reused-PID and invalid-file cases.
- [x] Stale-file reclamation that restores a different live holder that raced in before the stale file was renamed.
- [x] A CLI that waits, names the holder, runs a command under the hold and keeps its exit code. Packed-consumer checks run the installed executable and verify its hold and release.
- [x] First-wait and minute reminders, plus elapsed wait on acquisition.
- [x] Descendant joining through the inherited hold ID, in-process joining through `HeldLock`, and CI bypass with an empty held environment.
- [x] `withHeavyLock`, `acquireHeavyLock` and `heavyLockLayer`, using Effect scopes and a typed acquisition error. Tests cover Effect failure, interruption, waiter cleanup and Layer lifetime; packed type fixtures check the public signatures.
- [x] Child process-group leadership and forwarding of `SIGINT`, `SIGTERM` and `SIGHUP`, with the child's exit deciding the wrapper's exit. A waiting signal abandons the wait without releasing the holder.

## Next

- [ ] Add focused assertions for default path precedence, default command and polling interval, changed-holder reminders and direct `acquireHeavyLock` Scope lifetime. These details are implemented but do not all have dedicated behavioral assertions.
- [ ] Let a demonstrated host need decide portability or scheduling work; no additional lock policy is selected.

## Open questions

- Is one shared machine budget the lasting model, or should a real consumer eventually select separate resource classes? Multiple lock paths are possible, but that is not a tested resource-allocation policy.
- Are the currently exported protocol and CLI helper modules deliberate public extension points, or should a future API decision narrow the surface to acquisition and the holder protocol?
- Which operating systems and filesystems should have explicit host verification for C-locale process identity, hard-link acquisition, stale recovery and terminal signals?
- Is starvation under competing waiters a real problem that warrants a fairness policy? The package does not define an ordering policy.
