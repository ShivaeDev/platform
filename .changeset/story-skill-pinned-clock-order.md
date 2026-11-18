---
"@shivaedev/skills": patch
---

### Changed

- The story-testing skill says that the story's clock stands still until the kit advances it, so records written one after another carry the same timestamp and an ordering by that timestamp alone is arbitrary. A story whose claim depends on their order advances the clock in a kit verb between the writes, and the query ends its ordering with a unique tie-break column.
