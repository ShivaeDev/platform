---
"@shivaedev/quality": minor
---

### Breaking

- Unit tests now reject Effect runners, Clock and TestClock through runtime import chains, including production helpers and shared `it.effect` adapters. Use plain Vitest `it` and existing pure APIs for pure logic; move Effect behaviour to the package's story kit. Findings name the helper chain and terminal source location.
