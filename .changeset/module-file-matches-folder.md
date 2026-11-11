---
"@shivaedev/quality": patch
---

### Changed

- `files/named-after-export` accepts a file named like its own folder in any case, so a feature folder `notes/` can hold `Notes.ts` exporting `Notes`. The file name still follows its export's case.
