---
"@shivaedev/test-story": patch
---

### Fixed

- Creation failures keep their original cause and name the story kit, the create phase and the rerun command. Cleanup failures evaluate asynchronous inspect hooks with the kit's services and print their state instead of serializing an Effect.
