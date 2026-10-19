---
"@shivaedev/effect-react": patch
---

### Fixed

- Recheck the session when an automatic live connection fails with `Unauthorized`, so `SessionBoundary` shows its signed-out content without another query read, stops reconnecting while signed out and restores live updates after sign-in.
