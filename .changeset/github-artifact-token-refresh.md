---
"@shivaedev/effect-github": patch
---

### Fixed

- Refresh a rejected GitHub App installation token when downloading a workflow artifact archive and retry once, returning a typed failure on a second 401.
