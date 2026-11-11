---
"@shivaedev/quality": patch
---

### Changed

- A lint parses fewer source files more than once. The story rules and the story program now read one tree per source, released with the story program, and `boundaries/imported-change-keys`, `effect/service-model` and the typed half of `effect/boundary` skip sources they cannot match without parsing them. On this repository a fast lint makes about 16 % fewer parses and spends about 2 s less parsing. Findings and the largest live heap do not change.
