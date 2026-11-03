# @shivaedev/reconciler

Background work should read current state when its inputs change, when it starts, or when the next deadline arrives. Reconciler owns that wake-and-work lifecycle and its supervision. Applications own the queries, actions, change vocabulary and failure storage. Keep this package optional for SQL applications; its core needs only Effect and changes keys.

Preserve native errors, interruption, requirements and scoped resources first. Subscribe before reading, merge pending wakes, and keep at most one due timer. A failed reconciler must release its work without taking other reconcilers down. Keep state and resume visible through the handle, and let applications persist failures with ordinary SQL rather than introducing a journal or storage system here.

Keep keyed actions claimed while their key remains present, including after successful completion; removal releases the claim and interrupts unfinished work. Prefer a small lifecycle over automatic retries or polling. Usage is in [README.md](README.md); shared engineering rules are in the [repository guidance](../../AGENTS.md).
