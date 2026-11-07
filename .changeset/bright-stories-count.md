---
"@shivaedev/quality": patch
---

### Fixed

- `code/unused`: Follow Rolldown helpers through package import aliases and local config helpers, and resolve `import.meta.dirname` from the file that contains it.
- `effect/service-parameters`: Recognize host callbacks whose property type unions a function with an object hook.
- `effect/service-parameters`: Keep owned service state recognized when imported `Effect.fn` operations pass it through helpers across files.
