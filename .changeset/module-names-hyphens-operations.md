---
"@shivaedev/quality": patch
---

### Changed

- `files/named-after-export` accepts a folder's main file whose name matches the folder's ignoring case and separators: `reading-lists/ReadingLists.ts` exporting `ReadingLists` passes, while `reading-lists/ReadingListsItems.ts` still repeats its folder.
- `files/named-after-export` lets a file whose one export is a `query` or `command` from `@shivaedev/contract/operation.ts` repeat words of the folders above it, so `reading-lists/server/List.ts` exporting `List` passes. The file is still named after its operation, case included, and other files beside it, such as `reading-lists/server/listRows.ts`, still may not repeat a folder.
