# Changelog

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
