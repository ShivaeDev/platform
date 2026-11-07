---
"@shivaedev/quality": patch
---

### Fixed

- Follow service initializer state through nested helper calls, including helpers wrapped with `Effect.fn`, while reporting helpers with borrowed callers and exported service parameters.
- Recognize foreign host callbacks in inline plugin objects and class methods implementing foreign interfaces.
- Resolve build entries through Node path `dirname`, including roots derived from `import.meta.dirname` and `fileURLToPath(import.meta.url)`.
