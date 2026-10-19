---
"@shivaedev/effect-react": patch
---

### Fixed

- Wait for an active query loader before a newly mounted `useLoaderQuery` screen renders, so links to cached routes after invalidation show the changed data on their first render. Already mounted screens keep their data during refreshes.
