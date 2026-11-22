---
"@shivaedev/form": patch
---

### Fixed

- A save that a refresh overtook now shows the server's normalized value when that refresh already carries the saved value, instead of keeping the typed input until a later refresh that never comes. `useEditor` hits this when the record's pushed refetch arrives before the save's own answer.
