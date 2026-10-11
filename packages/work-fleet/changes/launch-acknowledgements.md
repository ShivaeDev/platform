### Fixed

- Limit worker launch acknowledgement waits to one second, preserving unresolved attempts for reconciliation while later launches continue in the same scheduler pass. Explicit queue-full rejections still stop the pass.
- Reuse a started thread after its first turn is explicitly rejected instead of leaving it behind when retrying on a fresh thread.
