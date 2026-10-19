---
"@shivaedev/effect-sql": minor
---

### Added

- `findMany` accepts a nonempty `orderBy` list of `{ field, direction }` entries, applying each in order to break ties with independently chosen directions. The single-object form and model field validation remain supported.
