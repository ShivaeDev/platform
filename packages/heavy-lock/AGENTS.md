# @shivaedev/heavy-lock

Heavy builds, type checks and test suites from different repositories compete for the same machine's memory. This package gives cooperating commands one shared lock, with a command line and an Effect API, so another run waits and can see who it is waiting for. It owns command coordination; application jobs belong to `effect-pg-boss`, and repository policy belongs to `quality`.

The holder is a process with a recorded start time, not just a PID. Its hold ends with its Effect scope; a child or nested Effect can join that hold without waiting for itself. Keep the shared file protocol small enough for another repository to implement without this package. Read [the north star](./docs/north-star.md) for the full boundaries, [the roadmap](./docs/roadmap.md) for work and open questions, and [the README](./README.md) for usage.

When goals conflict, lean in this order:

1. **Preserve the current holder.** A live holder must not be preempted, a reused PID must not protect a dead hold, and a waiter must never release someone else's lock.
2. **Keep resource lifetimes native.** Acquisition and release belong to Effect scopes. Failure and interruption must preserve the caller's result and clean up its own resources.
3. **Keep one protocol across repositories.** Prefer the existing file format, process identity and inherited owner ID over a second coordination path. Nested commands join the outer hold.
4. **Make waiting explain itself.** Name the holder and command. Forward the supported signals and let the child's result decide the command line's result.
5. **Stay small.** This is an advisory lock, not a scheduler, process supervisor or machine policy engine. Add behavior only when a real caller and a test establish the need.
