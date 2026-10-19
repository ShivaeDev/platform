---
"@shivaedev/work-board": patch
---

### Fixed

- Saving an answer, registering a question or preparing a handoff updates the index for the file it wrote instead of rereading the whole workspace, so the saved answer is confirmed and reaches open pages sooner.
- A new or removed folder, such as the response folder an answer lands in, is listed on its own instead of listing the whole workspace again.
- Startup lists the workspace once instead of twice before the first index.
