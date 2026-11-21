---
"@shivaedev/build": patch
---

### Fixed

- `generate` refuses an operation whose `run` returns a mapped type that takes its keys through a type parameter and ends with neither properties nor an index signature, such as `Counts<Letter>` with `type Counts<K extends string> = { [P in K]: number }` and `Letter = ("a" | "b") & Brand<"Letter">`, a generic interface's member such as `Box<Letter>["counts"]`, or `type LetterCounts = Record<Letter, number>`. TypeScript keeps no property for a branded literal key, so the wire wrote an empty struct and dropped every value. The keys of such a type cannot be read, so `Counts<never>` is refused too: return `{}` for an object meant to be empty, or a record keyed by `string` or a string brand.
