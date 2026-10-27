---
"@shivaedev/test-story": minor
---

### Added

- Compose independent feature kits with `storyKit({ name, extends: [first, second] })`, inferring their engines, traits, verbs and layer services in one per-test Scope with ordered creation and cleanup. Duplicate verb names, trait stage names and engine fields are rejected at the type level.
