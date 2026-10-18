### Fixed

- Continuing terminal work at full execution capacity records the request and resumes its existing worker thread ahead of new prepared work, including after a restart. Fleet records expose the queued message as the optional `pendingContinuation` string.
