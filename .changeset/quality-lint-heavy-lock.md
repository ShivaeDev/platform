---
"@shivaedev/quality": patch
---

### Fixed

- Run `quality lint`, including its Biome checks and pre-commit lint, under the shared heavy-process lock so concurrent local heavy commands wait their turn.
