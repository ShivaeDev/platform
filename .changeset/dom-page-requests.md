---
"@shivaedev/test-story": minor
---

### Added

- `domPage(url)` scopes global fetch URL resolution to an open DOM page and restores fetch and location when its scope closes. Pass its `pending` stream to `screenDriver` to wait for page fetches to resolve or reject.
