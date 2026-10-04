# @shivaedev/heavy-lock

One lock per machine for heavy commands: builds, type checks and test suites
from every repository on the machine run one at a time instead of exhausting
memory together. A waiting run says who holds the lock. CI skips it.

## Command line

```sh
pnpm add --save-dev @shivaedev/heavy-lock
```

```json
{
	"scripts": {
		"build": "heavy-lock -- tsc --build",
		"test": "heavy-lock -- vitest run"
	}
}
```

`heavy-lock -- <command> [args...]` waits for the lock, runs the command with
inherited stdio, and releases the lock when the command exits. While it waits
it prints to stderr who holds the lock, when it starts waiting, when the holder
changes and every minute:

```text
heavy-process lock: waiting for pid 41235 running `pnpm test` in /repos/app since 14:02:10 (1m 5s)
heavy-process lock: acquired after 2m 0s
```

| Exit code | Meaning |
| --- | --- |
| the command's | The command exited on its own. |
| 128 + signal number | The command died of a signal, such as 130 for SIGINT. A signal while waiting also exits this way, without running the command. |
| 127 | The command could not start. |
| 2 | Usage error: the arguments do not start with `--` followed by a command. |
| 1 | The lock could not be taken, for example because `ps` could not read this process's start time. |

The command runs in its own process group. SIGINT, SIGTERM and SIGHUP that
reach `heavy-lock` while the command runs are forwarded to that group once, so
Ctrl-C reaches the command exactly as it would without the lock, and the
command's exit decides `heavy-lock`'s.

A `heavy-lock` run inside a command that already holds the lock runs at once,
so a lock-wrapped script may call other lock-wrapped scripts.

On pnpm 11, installing into a project needs a decision on `msgpackr-extract`,
which `effect` pulls in: pnpm refuses its build script by default, and
`pnpm add` fails with `ERR_PNPM_IGNORED_BUILDS`. Record the decision under
`allowBuilds` in `pnpm-workspace.yaml`, or run `pnpm approve-builds`; `false`
skips the build. `pnpm dlx` and `pnpm add --global` need no setting.

```yaml
allowBuilds:
  msgpackr-extract: false
```

## Effect API

```ts
import { NodeServices } from "@effect/platform-node";
import { HeldLock } from "@shivaedev/heavy-lock/held-lock.ts";
import { withHeavyLock } from "@shivaedev/heavy-lock/with-heavy-lock.ts";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const build = Effect.gen(function* () {
	const held = yield* HeldLock;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	return yield* spawner.exitCode(ChildProcess.make("pnpm", ["build"], { env: { ...held.env }, extendEnv: true, stdout: "inherit", stderr: "inherit" }));
});

const program = withHeavyLock(build, { command: "pnpm build" }).pipe(Effect.provide(NodeServices.layer));
```

```ts
type HeavyLockServices = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;

interface HeavyLockOptions {
	readonly lockPath?: string; // default: HEAVY_PROCESS_LOCK, then ~/.cache/heavy-process.lock
	readonly command?: string; // what waiting runs print; default: this process's arguments
	readonly pollInterval?: Duration.Input; // default: 1 second
}

const withHeavyLock: <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	options?: HeavyLockOptions,
) => Effect.Effect<A, E | HeavyLockError, Exclude<R, HeldLock> | HeavyLockServices>;

const acquireHeavyLock: (options?: HeavyLockOptions) => Effect.Effect<HeldLockShape, HeavyLockError, Scope.Scope | HeavyLockServices>;

const heavyLockLayer: (options?: HeavyLockOptions) => Layer.Layer<HeldLock, HeavyLockError, HeavyLockServices>;

class HeldLock extends Context.Service<HeldLock, { readonly env: Readonly<Record<string, string>> }>()("@shivaedev/heavy-lock/HeldLock") {}
```

- `withHeavyLock` holds the lock while the effect runs and releases it when the
  effect succeeds, fails or is interrupted. Interrupting a waiter stops the wait
  and leaves nothing behind.
- `acquireHeavyLock` holds it until the surrounding Scope closes, and
  `heavyLockLayer` for as long as the Layer is in use.
- `HeldLock.env` is what a child process needs to join the hold instead of
  waiting for it: pass it to every heavy command the effect starts. It is empty
  when CI skipped the lock.
- A hold taken while `HeldLock` is already provided joins that hold.
- Waiting lines go to Effect's `Console` as errors.
- `NodeServices.layer` from `@effect/platform-node` provides `HeavyLockServices`.

## Environment

| Variable | Effect |
| --- | --- |
| `HEAVY_PROCESS_LOCK` | Lock file path. Defaults to `$HOME/.cache/heavy-process.lock`. |
| `CI` | Any non-empty value skips the lock. |
| `HEAVY_PROCESS_LOCK_ID` | Set for the command to the holder's id. A run that inherits the current holder's id runs at once. |

The Effect API reads these through Effect's `Config`, so a `ConfigProvider`
can supply them.

## Protocol

Other repositories on the same machine may implement this protocol in any
language; every implementation must follow it exactly to share the lock.

1. **Lock file.** `HEAVY_PROCESS_LOCK`, or `~/.cache/heavy-process.lock`. Its
   directory is created when missing.
2. **Holder.** The lock file holds one JSON object with exactly these keys, in
   this order, with no whitespace and no trailing newline:

   ```json
   {"id":"3f1c9a52-0d4e-4b8f-9a71-5c2e8d6b4f10","pid":4242,"processStartedAt":"Sat Sep 26 12:00:00 2026","command":"pnpm test","cwd":"/repo","startedAtMs":1790409600123}
   ```

   - `id`: a fresh random UUID per hold.
   - `pid`: the process that holds the lock and waits for the command, not the
     command itself.
   - `processStartedAt`: that process's start time exactly as
     `LC_ALL=C ps -o lstart= -p <pid>` prints it, trimmed of surrounding
     whitespace. The C locale keeps it byte-identical across implementations.
   - `command`: the command and its arguments joined by single spaces.
   - `cwd`: the working directory of the holder.
   - `startedAtMs`: when the lock was taken, in milliseconds since the epoch.
3. **Liveness.** A holder is live only while
   `LC_ALL=C ps -o lstart= -p <pid>`, trimmed, succeeds and prints exactly its
   `processStartedAt`. A pid the OS reused for another process therefore does
   not count. A holder that is missing a key, has a key of the wrong type or is
   not JSON is not live.
4. **Acquire.** Write the complete holder to `<lock>.<id>.draft`, then hard-link
   the draft to the lock path and delete the draft. The link is atomic, so no
   reader ever sees a partial file. If the link fails with `EEXIST`:
   - a live holder holds the lock: wait, polling about once a second; a live
     holder is never preempted;
   - otherwise reclaim the lock: rename it to `<lock>.<uuid>.stale`; if the
     rename fails with `ENOENT`, someone else reclaimed it. Read the renamed
     file; if it names a live holder other than the one judged stale (a waiter
     raced in before the rename), hard-link it back to the lock path, ignoring
     `EEXIST`. Delete the stale file and try the link again.
5. **Fail fast.** An implementation that cannot read its own
   `processStartedAt` stops before taking the lock, because a holder without it
   would be reclaimed at once.
6. **Release.** When the command exits, or the holding process does, delete the
   lock file only if it still names the holder's `id`.
7. **Re-entrancy.** Run the command with `HEAVY_PROCESS_LOCK_ID=<id>`. A run
   whose inherited `HEAVY_PROCESS_LOCK_ID` equals the `id` in the lock file
   runs at once, without taking or releasing the lock.
8. **CI.** A non-empty `CI` skips the lock entirely: the command runs at once
   and gets no `HEAVY_PROCESS_LOCK_ID`.
9. **Status.** A waiting run prints to stderr, when it starts waiting, when the
   holder's `id` changes and every minute,
   ``heavy-process lock: waiting for pid <pid> running `<command>` in <cwd> since <HH:MM:SS> (<elapsed>)``,
   and once it gets the lock after waiting,
   `heavy-process lock: acquired after <elapsed>`. The time is local, and
   `<elapsed>` is `<s>s` under a minute and `<m>m <s>s` from a minute on.

The package's `test/fixtures/reference-holder.lock` holds a holder file in the
protocol's exact byte format; its tests encode, decode and wait on it byte
for byte.
