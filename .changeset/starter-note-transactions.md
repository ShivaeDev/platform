---
"@shivaedev/create-app": patch
---

### Fixed

- Generated apps apply the host's replacement Layer to module ports before binding services, including the notes source, rate-limit store and job queue.
- Note creation, import and edits commit with their word-count enqueue. An enqueue failure rejects the request and rolls back the note write.
