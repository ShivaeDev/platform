---
"@shivaedev/quality": patch
---

### Changed

- `noShadowRestrictedNames` no longer reports Effect's root modules named after a global (`Array`, `BigInt`, `Boolean`, `Function`, `Number`, `RegExp`, `String`, `Symbol`) when they are imported from `effect` under their own names. Every other shadowing of a restricted name, including those names imported from another module or renamed from another `effect` export, is still reported.
