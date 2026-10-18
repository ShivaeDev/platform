### Fixed

- Observe pg-boss connection errors throughout startup and shutdown, and log administrator-terminated connections at debug while preserving query failures and application error callbacks.
- Keep observing idle errors from closing sockets after shutdown, when shutdown fails, and when `stop({ close: false })` leaves the pool open.
