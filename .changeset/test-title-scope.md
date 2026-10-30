---
"@shivaedev/quality": patch
"@shivaedev/create-app": patch
---

### Changed

- Quality applies Biome’s test-title check only to `*.test.*`, `*.spec.*` and `test-support/` files, so ordinary helpers named `describe`, `it` or `test` do not receive test-title findings.
- Quality and starter guidance explain that a `CreateSpace` component in `spaces/client/` is named `Create.tsx`, keeping the full export name without repeating a folder in the file name.
