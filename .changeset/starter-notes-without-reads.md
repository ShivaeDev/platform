---
"@shivaedev/create-app": patch
---

### Changed

- Generated apps' notes queries leave out `reads`: `notes.get` listens on the note's row and `notes.list` on its owner's bucket, the keys their repository calls filter by. The note statistics query keeps `reads: () => [notes.list]`, because it counts the whole table through raw SQL.
