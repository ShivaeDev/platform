---
"@shivaedev/service": patch
"@shivaedev/github": minor
---

### Breaking

- `@shivaedev/github`: Replace `@shivaedev/github/list.ts` with `github.listPages(path, schema, options)` and flatten each page's `items` with `Stream.flatMap` when consuming individual items.
- `@shivaedev/github`: Replace `@shivaedev/github/listPages.ts` with `github.listPages(path, schema, options)`.
- `@shivaedev/github`: Replace `@shivaedev/github/listBounded.ts` with `github.listBounded(path, schema, pageCap, options)`.

### Fixed

- `@shivaedev/service`: Preserve schema result types and decoding service requirements through generic service methods.
