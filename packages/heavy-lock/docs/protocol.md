# Shared heavy-process lock protocol

The command line and Effect API use the same protocol. Another implementation must use the same lock path, holder format and ownership rules to participate. This reference describes the file exchange; the [README](../README.md) explains scoped usage.

## Holder file

The file is one JSON object, in this key order, with no formatting whitespace or trailing newline:

```json
{"id":"3f1c9a52-0d4e-4b8f-9a71-5c2e8d6b4f10","pid":4242,"processStartedAt":"Sat Sep 26 12:00:00 2026","command":"pnpm --filter \"@shivaedev/*\" test","cwd":"/repo/checkout","startedAtMs":1790409600123}
```

These are the exact bytes in `src/test-support/fixtures/reference-holder.lock`. The protocol tests encode and decode that fixture, and a file in that format naming a live process blocks another caller.

| Field | Meaning |
| --- | --- |
| `id` | A fresh random UUID identifying one hold. |
| `pid` | The process holding the lock and waiting for its command. |
| `processStartedAt` | The holding process's start time from `LC_ALL=C ps -o lstart= -p <pid>`, with surrounding whitespace trimmed. |
| `command` | The command description; the CLI joins the executable and arguments with single spaces. |
| `cwd` | The holder's working directory. |
| `startedAtMs` | Acquisition time in milliseconds since the epoch. |

The PID alone is insufficient. The holder is live only when `ps` succeeds, prints a nonempty start time and that time equals `processStartedAt`. A dead process or a reused PID with a different start time does not protect the lock. An undecodable holder file does not identify a live holder.

## Acquire and reclaim

1. Resolve the path from the Effect API's explicit `lockPath`, then `HEAVY_PROCESS_LOCK`, then `HOME/.cache/heavy-process.lock`. Create its directory if missing.
2. Read this process's start time before taking a new hold. If `ps` cannot run or supplies no start time, fail before starting the command.
3. Write the complete holder to `<lock>.<id>.draft`, hard-link the draft to `<lock>` and remove the draft. The complete file is published through the link rather than written into an already visible lock path.
4. If the path already exists and its holder is live, return that holder to the waiting loop. Do not preempt it.
5. Otherwise rename the path to `<lock>.<uuid>.stale`. If the path disappeared before the rename, retry acquisition.
6. Read the renamed file. If it identifies a different live holder that raced in before the rename, hard-link it back to `<lock>`, leaving an already existing lock path alone. Remove the stale file and retry acquisition.

The scoped `waitForLock` loop makes acquisition and registration of its release finalizer uninterruptible together. The lower-level `tryAcquire` does not register a finalizer. An interrupted waiter leaves the current holder's file unchanged and no draft behind.

## Release and joined holds

Release removes the lock only when the decoded file still names the releasing hold's ID. A joined caller neither acquires nor registers a release for the outer hold.

A child receives `HEAVY_PROCESS_LOCK_ID=<id>`. A run joins when its inherited ID equals the ID in the lock file. This join checks the recorded ID; it does not repeat the liveness check used when competing for a new hold. If the old file is gone, an inherited ID does not prevent a fresh acquisition.

An Effect acquisition joins an existing `HeldLock` service before reading settings. In that case the existing hold's environment is returned directly.

## CI and waiting output

A nonempty `CI` value skips acquisition. The API returns an empty held environment; the CLI supplies no new hold ID to the child. The child still inherits its surrounding environment, so this does not clear an ID that was already inherited. Settings resolve a usable lock path before applying the CI bypass.

A waiter prints through Effect's `Console.error`, which the CLI sends to stderr, when it first sees a holder, when the holder's ID changes and every minute. The waiting line names the PID, command, directory, local acquisition time and age of the hold. After waiting, acquisition prints the caller's elapsed wait.

```text
heavy-process lock: waiting for pid 41235 running `pnpm test` in /repo since 14:02:10 (1m 5s)
heavy-process lock: acquired after 2m 0s
```

Elapsed durations use seconds under a minute and minutes plus seconds from a minute onward. The [roadmap](./roadmap.md) identifies remaining focused verification and host questions.
