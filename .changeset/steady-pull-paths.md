---
"@shivaedev/github": patch
"@shivaedev/work-fleet": patch
---

### Fixed

- `@shivaedev/github`: Keep cached pagination links when GitHub omits them from a 304 response, so repeated reads return every page.
- `@shivaedev/work-fleet`: Continue reviewing ordinary pull requests whose complete changed-path listings are revalidated by GitHub.
