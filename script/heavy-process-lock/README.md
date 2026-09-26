# Heavy-process lock

`node script/heavy.ts <command> [...args]` runs a command under one lock shared
by every repository on the machine, so typecheck, test and build runs from
parallel checkouts queue instead of exhausting memory. A waiting run prints who
holds the lock when it starts waiting, when the holder changes, and every
minute.

The root `build`, `typecheck`, `typecheck:compat`, `test` and `test:package`
scripts take it. `ready` runs those steps, so it takes the lock once per step
and other repositories can run between steps. `lint` and `test:script` are
light and do not take it. Run any other heavy command through
`pnpm heavy <command>`.

## Protocol

Other repositories on the same machine may implement the same protocol; keep
implementations in sync.

- **Lock file**: `~/.cache/heavy-process.lock`, or `HEAVY_PROCESS_LOCK`. It
  holds the holder as JSON: `{"id","pid","processStartedAt","command","cwd","startedAtMs"}`,
  in that key order. `processStartedAt` is the holder process's start time as
  `LC_ALL=C ps -o lstart= -p <pid>` prints it, trimmed.
- **Acquire**: write the holder to `<lock>.<id>.draft` and hard-link it to the
  lock path. `EEXIST` means the lock is held.
- **Stale holders**: a holder is live only while `ps` reports its pid with
  the recorded `processStartedAt`, so a pid the OS reused after a `SIGKILL`
  does not count. A lock whose holder is not live, or which names no holder
  (including one without `processStartedAt`), is renamed to
  `<lock>.<uuid>.stale` and deleted; if a live holder raced in before the
  rename, its lock is linked back. A live holder is never preempted.
- **Release**: only the holder whose id is in the file removes it, when the
  command exits or the process does.
- **Re-entrancy**: the command runs with `HEAVY_PROCESS_LOCK_ID=<id>`. A nested
  heavy run whose inherited id names the current holder runs without waiting.
- **CI**: any non-empty `CI` skips the lock.

## Scope

The directory has no dependencies and imports nothing outside itself, so
`@shivaedev/quality` can adopt it with `script/heavy.ts`; it does not yet. The
tests run with `node --test` (`pnpm test:script`). `script/heavy.ts` is exempt
from the ambient-runtime lint plugin because it wires `process.env`, the wall
clock and stderr into a program that runs outside Effect.
