# @shivaedev/heavy-lock

Heavy commands from different repositories compete for the same machine's memory. This package gives cooperating builds, type checks and test suites one shared lock, so another run waits its turn and tells you which command holds it.

## Why you want this

A build in one repository cannot see that a test suite in another already uses the machine. Wrap each heavy command once, and both use the same lock:

```sh
heavy-lock -- pnpm build
```

The command that gets the lock runs. The next waits, names the holder, and runs after the first releases it. A wrapped script can call another wrapped script: the inner command joins the hold instead of waiting for itself. The command's own exit code stays visible to the caller.

## Using it

### How to think about it

A **holder** is the process that takes the lock and waits for its command. The lock file records that process's PID, its process start time, a fresh hold ID, the command, the working directory and when the hold began. PID and process start time together distinguish a live holder from a PID the operating system reused.

A **hold** lasts until the owner's scope closes. Another caller using the same lock path waits while the holder is live. A dead holder, a mismatched process start time or an invalid holder file can be reclaimed. Release checks the hold ID before removing the file, so a caller cannot release a different holder's lock.

A **joined hold** lets nested work share its owner's lifetime. The command line gives the child `HEAVY_PROCESS_LOCK_ID`; a nested run joins when that ID matches the lock file. In an Effect program, an existing `HeldLock` service joins directly. Joining does not take ownership of release: the outer hold remains in charge.

This is an advisory lock. Give cooperating commands the same path and route their heavy work through it. [The shared protocol](https://github.com/ShivaeDev/platform/blob/main/packages/heavy-lock/docs/protocol.md) describes how another implementation can participate.

### Once per repository: wrap the heavy scripts

Put the wrapper on the scripts that start heavy work:

```json
{
  "scripts": {
    "build": "heavy-lock -- tsc --build",
    "ready": "heavy-lock -- pnpm run build",
    "test": "heavy-lock -- vitest run"
  }
}
```

`ready` holds the lock while it calls `build`; `build` joins that hold. The separator is required: `heavy-lock -- <command> [args...]` runs one executable with its arguments.

### Every run: read the wait and the result

```sh
heavy-lock -- pnpm test
```

The wrapper waits for the lock, starts the command with inherited standard input, output and error streams, and releases its hold when the command exits.

A waiter prints to stderr when it starts waiting and reminds you every minute. After it acquires the lock, it prints how long it waited:

```text
heavy-process lock: waiting for pid 41235 running `pnpm test` in /repo since 14:02:10 (1m 5s)
heavy-process lock: acquired after 2m 0s
```

The waiting line identifies the holder's PID, command and directory. The time is local; the duration in that line is the age of the hold. The acquired line measures this caller's wait.

| Exit code | Meaning |
| --- | --- |
| The command's code | The command exited on its own, including an exit chosen by its signal handler. |
| `128 + signal number` | The command died from a signal, or the wrapper received a supported signal while waiting. |
| `127` | The executable could not start. |
| `2` | Arguments did not start with `--` followed by an executable. |
| `1` | Lock acquisition failed, including an unreadable process start time. |

The child is the leader of its own process group. While it runs, the wrapper forwards `SIGINT`, `SIGTERM` and `SIGHUP` to it, and the child's exit decides the wrapper's exit. A signal while waiting stops the wait and leaves the current holder's file alone.

### Once per Effect program: provide the hold

Use `withHeavyLock` when one Effect owns the heavy work. Read `HeldLock.env` and pass it to any child that may itself run a wrapped command:

```ts
import { NodeServices } from "@effect/platform-node";
import { HeldLock } from "@shivaedev/heavy-lock/held-lock.ts";
import { withHeavyLock } from "@shivaedev/heavy-lock/with-heavy-lock.ts";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const build = Effect.gen(function* () {
  const held = yield* HeldLock;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const command = ChildProcess.make("pnpm", ["build"], {
    env: { ...held.env },
    extendEnv: true,
    stderr: "inherit",
    stdout: "inherit",
  });
  return yield* spawner.exitCode(command);
});

const program = withHeavyLock(build, { command: "pnpm build" }).pipe(
  Effect.provide(NodeServices.layer),
);
```

`withHeavyLock` provides `HeldLock` to `build`. `NodeServices.layer` supplies the filesystem, path and process-spawning services. The lock is released when the Effect succeeds, fails or is interrupted; a failure from `build` stays its own failure. Interrupting a waiter leaves the existing holder and no temporary draft behind.

For a service that owns the hold through a Layer, use `heavyLockLayer`:

```ts
import { NodeServices } from "@effect/platform-node";
import { HeldLock } from "@shivaedev/heavy-lock/held-lock.ts";
import { heavyLockLayer } from "@shivaedev/heavy-lock/with-heavy-lock.ts";
import { Effect, Layer } from "effect";

const lockLayer = heavyLockLayer({ command: "asset pipeline" }).pipe(
  Layer.provide(NodeServices.layer),
);

const program = Effect.gen(function* () {
  const held = yield* HeldLock;
  return held.env;
}).pipe(Effect.provide(lockLayer));
```

The Layer owns the hold for its lifetime. Use `acquireHeavyLock` directly when the surrounding Scope should own acquisition:

```ts
import { NodeServices } from "@effect/platform-node";
import { acquireHeavyLock } from "@shivaedev/heavy-lock/acquire.ts";
import { Effect } from "effect";

const program = Effect.scoped(
  Effect.gen(function* () {
    const held = yield* acquireHeavyLock({ command: "asset pipeline" });
    return held.env;
  }),
).pipe(Effect.provide(NodeServices.layer));
```

`acquireHeavyLock` returns the held environment rather than providing the service. Its surrounding Scope owns release. A nested `withHeavyLock` joins an existing `HeldLock` service instead of waiting for itself.

### API

Import the module that defines each name; there is no root entry.

| Module | Exports |
| --- | --- |
| `@shivaedev/heavy-lock/acquire.ts` | `acquireHeavyLock`, `HeavyLockOptions`, `HeavyLockServices` |
| `@shivaedev/heavy-lock/with-heavy-lock.ts` | `withHeavyLock`, `heavyLockLayer` |
| `@shivaedev/heavy-lock/held-lock.ts` | `HeldLock`, `HeldLockShape` |
| `@shivaedev/heavy-lock/error.ts` | `HeavyLockError`, `failWith` |

The acquisition declarations use these types:

```ts
import type { HeavyLockError } from "@shivaedev/heavy-lock/error.ts";
import type { HeldLock } from "@shivaedev/heavy-lock/held-lock.ts";
import type { Duration, Effect, FileSystem, Layer, Path, Scope } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";

export interface HeavyLockOptions {
  readonly command?: string | undefined;
  readonly lockPath?: string | undefined;
  readonly pollInterval?: Duration.Input | undefined;
}

export type HeavyLockServices =
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner;

export interface HeldLockShape {
  readonly env: Readonly<Record<string, string>>;
}

export declare const withHeavyLock: <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options?: HeavyLockOptions,
) => Effect.Effect<A, E | HeavyLockError, Exclude<R, HeldLock> | HeavyLockServices>;

export declare const acquireHeavyLock: (
  options?: HeavyLockOptions,
) => Effect.Effect<HeldLockShape, HeavyLockError, Scope.Scope | HeavyLockServices>;

export declare const heavyLockLayer: (
  options?: HeavyLockOptions,
) => Layer.Layer<HeldLock, HeavyLockError, HeavyLockServices>;
```

`HeldLock` is an Effect service whose value is `HeldLockShape`. Its `env` contains the hold ID for children, and is empty when CI skips acquisition. `HeavyLockError` has the tag `HeavyLockError`, a `message` and an optional `cause`; caller failures remain separate from acquisition failures. `failWith(message)` constructs an error mapper that keeps the cause.

| Option | Meaning | Default |
| --- | --- | --- |
| `command` | Command description recorded for waiters. | This process's arguments after the executable, joined with spaces. |
| `lockPath` | File every participating caller shares. | `HEAVY_PROCESS_LOCK`, then `HOME/.cache/heavy-process.lock`. |
| `pollInterval` | Delay between waiting attempts. | One second. |

The package also exposes the modules that implement its shared protocol:

| Module | Exports |
| --- | --- |
| `holder.ts` | `HOLDER_ID_ENV`, `Holder` schema and type, `encodeHolder(holder)`, `decodeHolder(raw)` |
| `lock-file.ts` | `readHolder(lock)`, `tryAcquire(lock, holder)`, `release(lock, id)`, `reclaim(lock, dead)` |
| `process-start.ts` | `processStartTime(pid)`, `isHolderAlive(holder)` |
| `settings.ts` | `Settings`, `readSettings(lockPath)` |
| `status.ts` | `elapsed(fromMs, toMs)`, `waitingLine(holder, nowMs)`, `acquiredLine(waitStartedMs, nowMs)` |
| `wait.ts` | `Claim`, `WaitOptions`, `waitForLock(lock, claim, options)` |
| `cli/args.ts` | `CommandLine`, `USAGE`, `parseCommandLine(args)` |
| `cli/program.ts` | `program(args)` |
| `cli/run-command.ts` | `runCommand(commandLine, env, signals)` |
| `cli/signals.ts` | `ForwardedSignal`, `signalExitCode(signal)`, `receiveSignals` |

Each path has the prefix `@shivaedev/heavy-lock/`. `Holder` holds `id`, `pid`, `processStartedAt`, `command`, `cwd` and `startedAtMs`; `Claim` omits the acquisition time. `WaitOptions` names `pollInterval` as `Duration.Input` and `remindEvery` as `Duration.Duration`. `Settings` holds `ci`, the optional inherited ID and the resolved `lock` path. The [protocol reference](https://github.com/ShivaeDev/platform/blob/main/packages/heavy-lock/docs/protocol.md) describes the holder and acquisition rules. Use the scoped acquisition API for ordinary command wrapping.

`tryAcquire` returns `Option.none()` after acquiring or `Option.some(holder)`
when another live holder blocks it. It does not require `Scope` or register a
release finalizer; its caller must release an acquired hold. `waitForLock` owns
that scoped waiting and release lifecycle.

### Install and environment

```sh
pnpm add --save-dev @shivaedev/heavy-lock @effect/platform-node@4.0.0-rc.112 @effect/platform-node-shared@4.0.0-rc.112 effect@4.0.0-rc.112
```

The Effect packages are peers. Use the versions required by this package's `peerDependencies` together. The package requires Node 24 or later.

| Variable | Meaning |
| --- | --- |
| `HEAVY_PROCESS_LOCK` | Shared lock path when `lockPath` is not supplied. |
| `HOME` | Supplies `HOME/.cache/heavy-process.lock` when no explicit path is supplied. |
| `HEAVY_PROCESS_LOCK_ID` | An inherited hold ID; joins when it matches the lock file. |
| `CI` | A nonempty value skips acquisition. An empty value does not. |

The Effect API reads these through Effect's `Config`, so a `ConfigProvider` can supply them. CI gives `HeldLock.env` no new owner ID and leaves another holder's lock alone.

### Limits

- Participants must share a lock path. This does not stop commands that run outside the protocol.
- Acquisition needs `ps -o lstart= -p <pid>` in the C locale and a filesystem that supports hard links and rename in the lock directory.
- The holder's identity is the wrapper process and its start time. A matching inherited hold ID joins the recorded hold; it is not an authentication token.
- A stopped holder can leave a file behind. The next acquisition checks its identity and reclaims a stale file; do not remove a live holder's file to hurry a waiter.
- Signal forwarding does not promise delivery to every descendant or exactly-once delivery under terminal-generated signals.
