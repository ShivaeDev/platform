### Fixed

- Continuing terminal work at full execution capacity records the request and resumes its existing worker thread ahead of new prepared work, including after a restart. Fleet records expose the queued message as the optional `pendingContinuation` string.
- Queued continuations report admission waits and stop for a normal decision when their brief changes. Archived cycles retain their decision owner and exclude queue state.

### Added

- `AttemptProgress` groups the existing worker progress, brief-steering and stall-recovery schemas.
