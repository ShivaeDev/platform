---
"@shivaedev/work-board": patch
---

### Fixed

- Saving an answer, registering a question or preparing a handoff updates the index for the file it wrote instead of rereading the whole workspace, so the saved answer is confirmed and reaches open pages sooner.
- A new, moved or removed folder updates the index for the files it holds instead of rereading every file.
- Startup lists the workspace once instead of twice before the first index.
