---
"@shivaedev/build": patch
---

### Fixed

- `generate` refuses an operation whose `run` returns a mapped type the application writes over branded literal keys, such as `{ [L in Letter]: number }` with `Letter = ("a" | "b") & Brand<"Letter">`, also behind `Partial`, `Readonly` or `Required`, with the message a `Record` over such keys gets. TypeScript keeps no property for those keys, so the wire wrote an empty struct and dropped every value.
