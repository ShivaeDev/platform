---
"@shivaedev/react": patch
---

### Fixed

- `usePendingCommand` keeps the requested value after a successful command until a watched query delivers its next settled Result, so a switch backed by a live query no longer flips back to the old value before the server's push arrives.
