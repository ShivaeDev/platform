---
"@shivaedev/vitest-rerun": patch
---

### Fixed

- Refuse reruns that change a test name, suite name or task kind at the same Vitest ID, preserving the earlier final reports instead of reporting a false recovery.
