---
"@shivaedev/quality": minor
---

### Added

- `imports/resolvable` accepts a tracked `README.md` in a declared `generated` folder, beside `.gitkeep` and `.keep`, so the folder can name the command that writes its output.
- Quality follows imports through modules the sources import that git ignores, such as generated output, without reporting them: `imports/runtime` and transitive fences report the checked file whose import reaches forbidden code through them, naming the chain, and `code/unused` counts their imports as uses.
