---
"@shivaedev/quality": patch
---

### Changed

- `@shivaedev/quality`: `effect/unsafe-calls` exempts a bare Effect `…Unsafe` call only inside an object-literal or class member named `…Unsafe`, which implements an unsafe member of an interface, such as `makeUnsafe: () => wire.makeUnsafe()`. A function or variable named `…Unsafe`, such as `function parseUnsafe(header) { return DateTime.makeUnsafe(header) }`, no longer silences the finding: use the safe counterpart the finding names inside it.
