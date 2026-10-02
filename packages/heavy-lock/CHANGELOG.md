# Changelog

## Unreleased

### Changed

- Validate packed consumers and executable bins through the shared workspace gate.

- Trim test support comments, so the package passes the comment rules of `@shivaedev/quality`.

## 0.2.0 - 2026-09-28

### Changed

- Add `@effect/platform-node-shared` as a peer dependency pinned to the same
  exact version as the `effect` and `@effect/platform-node` peers, so an
  install holds one copy of Effect. An application that uses `withHeavyLock` and
  already depends on the Effect stack adds `@effect/platform-node-shared` at
  that version; pnpm, npm and Bun install it otherwise.

### Fixed

- Pin `@effect/platform-node-shared` to the `effect` version, so the
  `heavy-lock` command starts after a fresh install. Before,
  `@effect/platform-node` resolved a newer `@effect/platform-node-shared`
  prerelease than its `effect`, and the command crashed on start importing
  modules that `effect` lacks.

## 0.1.0 - 2026-09-26

### Added

- Add the `heavy-lock -- <command> [args...]` command line: it runs the command
  under one lock shared by every repository on the machine, with inherited
  stdio. A waiting run names the holder when it starts waiting, when the holder
  changes and every minute. It exits with the command's exit code, 128 plus the
  signal number when the command dies of a signal, 127 when the command cannot
  start, 2 on a usage error and 1 when the lock cannot be taken.
- Forward SIGINT, SIGTERM and SIGHUP to the command's process group while it
  runs. A signal while waiting abandons the wait and leaves the holder's lock
  alone.
- Add `withHeavyLock`, `acquireHeavyLock` and `heavyLockLayer` to hold the lock
  around an Effect, for a Scope or for a Layer's lifetime, and the `HeldLock`
  service with the environment a child process needs to join the hold. A hold
  taken inside another joins it.
- Implement the heavy-process lock protocol: the holder file, its key order and
  C-locale process start time, atomic hard-link acquisition, reclaiming dead,
  reused-pid and unreadable holders, release by the holder only, re-entrancy
  through `HEAVY_PROCESS_LOCK_ID`, and the `CI` bypass.
