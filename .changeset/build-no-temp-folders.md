---
"@shivaedev/build": patch
---

### Fixed

- Generating no longer leaves an empty `.<file>.XXXXXX` folder beside every file it writes, under `src/generated` and in `node_modules/.cache/@shivaedev/build`. Each write still replaces the file in one rename, and its temporary folder is removed when the write ends, also when it fails or is interrupted. Folders left by earlier versions stay until you delete them.
