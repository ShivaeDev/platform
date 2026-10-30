---
"@shivaedev/create-app": minor
---

### Breaking

- Generated notes apps remove the test-only `notes.whoami` RPC. Read the viewer through identity's session API instead.

- Notes RPC callers decode raw titles with `NoteFields` or `NoteEditFields` before submitting; title validation now happens in the Schema. Handle database constraint rejections as `Conflict` and unexpected failures as `InternalServerError`.

### Fixed

- Generated apps retain database failure causes, report constraint violations as conflicts, validate trimmed titles in their Schema, and show the session error screen for malformed session payloads.
