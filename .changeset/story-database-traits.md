---
"@shivaedev/test-sql": minor
"@shivaedev/test-story": minor
---

### Added

- `@shivaedev/test-sql`: The `storyDatabase` controller lets a trait select an empty or migrated template before acquiring a story's scoped database clone.
- `@shivaedev/test-story`: Stage `after` hooks can return a native Effect Context to provide services to later stages and the story body, including application startup and scoped teardown.
