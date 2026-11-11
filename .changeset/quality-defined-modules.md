---
"@shivaedev/quality": patch
---

### Fixed

- `imports/runtime` takes a file that calls `defineModule` as server code, so a defined module may import server code, and client or shared code that imports the module itself is reported with the generated client as the repair. It no longer follows a generated client's type import of its own module.
- `imports/fences` no longer follows a generated client's type import of its own module, so a page that imports another package's generated client needs no exception for the module behind it; the client's value imports still count.
- `imports/resolvable` accepts another workspace package's import of a file in a declared generated folder, such as `@scope/notes/generated/Notes.ts`, before the generator writes it.
- `docs/references` accepts a module path or a link into a declared generated folder before the generator writes the file.
