---
"@shivaedev/work-board": patch
---

### Changed

- When the Fleet daemon is not running, Today's In progress section says "Fleet isn't running, so agent work and its health are unknown." instead of a CLI hint, and System shows one Fleet card marked Not running instead of separate Codex, GitHub, Fleet and Fleet work cards. Both pages keep the exact `work-fleet serve <board> --port <port>` command, with this Board's folder and Fleet port, in a "How to start Fleet" popover. The unavailable Fleet items projection and the error diagnostics observation carry that command as an optional `startCommand`.
- The System Fleet card's state reflects only Fleet health (capacity and clock). Fleet's own waiting counts no longer mark it as needing attention, so the only needs-you number on System is the Board's count shown on Today and in the sidebar.
