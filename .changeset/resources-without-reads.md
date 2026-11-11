---
"@shivaedev/create-app": patch
---

### Changed

- `create-app resource` writes a list query without `reads`. Its repository read filters by the signed-in owner, so an open list listens on that owner's bucket, the same key the removed declaration named. The generated stories keep a list open and check that it receives its owner's new item and no update for another account's.
