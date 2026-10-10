# North star

## The problem

A repository's build script knows about its own work, not every other repository on the machine. A build, a type check and a test suite can all start together, each reasonable alone and expensive together. Separate per-repository locks leave that problem untouched. Developers also need to distinguish a command that is doing work from one that is waiting, and nested scripts must not wait forever for a lock their parent already holds.

The package gives cooperating commands one file protocol and one hold per shared path. The command line and the Effect API are two ways to participate in that same protocol. This is repository tooling; it does not replace an application's durable job queue or decide which commands a developer may run.

## The ideal

A repository wraps its heavy entry points once. A caller either owns the hold or waits for a named holder. Nested work joins its owner and leaves release to that owner. Waiting is visible: the holder's command, directory and identity make it clear why work has not started.

Ownership is stronger than a PID. Operating systems reuse PIDs, and killed processes can leave files behind. A hold records both the process's PID and its start time in a locale-independent form, plus an ID for that particular hold. A live process with the recorded start time remains the holder. A stale file can be reclaimed without mistaking a newly created live hold for the dead one.

Effect owns resource lifetimes. A hold is acquired with its release already registered in the scope. Caller failures and interruption stay intact. The CLI participates in that lifetime rather than layering a separate cleanup protocol on top, and a child process receives the ID needed to join it.

## What good looks like

- Two repositories can share the protocol without sharing application dependencies or runtime code.
- A waiter does not publish a partial holder file, preempt a live holder or release a different hold.
- A nested Effect or child command uses the existing hold and does not acquire a competing one.
- A failed or interrupted caller leaves its own resources clean and preserves the result that tells the caller what went wrong.
- A waiting developer can identify the command ahead of them without opening the lock file.
- The file format and liveness check remain small enough to implement in another language.

## Trade-offs

**Preserve ownership before reducing wait time.** A live holder wins over an impatient caller. Do not add a timeout that deletes another process's file. Process identity and reclamation races deserve stronger evidence than a faster happy path.

**Keep scopes native before adding convenience.** The Effect API should expose ordinary services, scopes, Layers and typed errors. A helper is worthwhile when it removes repeated acquisition work without obscuring who owns release.

**Keep one protocol before adding control modes.** The CLI and API share the holder format and ID. Resource classes, concurrency limits or priority scheduling would change the coordination model and need a maintainer decision, not an extra flag beside the existing path.

**Prefer a small local mechanism over broad portability claims.** Process start times come from C-locale `ps`; acquisition uses filesystem hard links and rename. Supporting another host means proving those boundaries, rather than weakening the identity check to a PID or claiming the same behavior everywhere.

**Keep diagnostics useful before making them clever.** A waiting line should name the holder. The child's result should decide the CLI's result. Avoid another logging or process-management abstraction just to wrap one executable.

## What it leaves out

- Enforcement against commands that do not participate, memory monitoring, or automatic decisions about which work is heavy.
- Distributed locks, durable jobs, scheduling priorities, multiple permits or fairness policies.
- Application authorization or authentication through the inherited hold ID.
- A process supervisor responsible for every descendant's lifecycle or a guarantee of exactly-once terminal-signal delivery.
- Repository lint rules, release policy and task tracking; those belong to their own packages and tools.

[The protocol](./protocol.md) records interoperability details. [The roadmap](./roadmap.md) owns implementation status and the maintainer's open choices.
