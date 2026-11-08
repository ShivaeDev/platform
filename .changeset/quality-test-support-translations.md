---
"@shivaedev/quality": patch
---

### Fixed

- `effect/failure-honesty` accepts a blanket `catch` in `test-support/` whose handler derives its value from the caught error, which is how story readouts translate failures into domain words. A handler that ignores its error and the same catch outside `test-support/` are still reported.
- `suppressions/no-double-cast` treats writes on a freshly built object as construction: `Object.assign(new X(...), ...)`, and `Object.assign` or `Object.defineProperty` on a local `const` initialised with `new X(...)` that nothing has used before the write. Assigning onto a caller's object is still reported.
