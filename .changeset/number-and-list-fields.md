---
"@shivaedev/form": minor
---

### Added

- `Field.number({ optional, min, max, integer })` supplies a finite numeric string codec with inclusive bounds and blank-as-null optional values. `numberInput` binds the encoded text to an input without losing invalid input.
- `Field.list(item, { min, max })` bounds arrays with native Schema checks. The React `useList` hook adds, edits and removes items and exposes feedback for each current item.
