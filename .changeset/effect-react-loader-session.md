---
"@shivaedev/effect-react": patch
---

### Fixed

- Route loaders and `loadQuery` recheck the owning `SessionBoundary` session once when a query fails with `Unauthorized`, so sign-in redirects can see an ended session.
