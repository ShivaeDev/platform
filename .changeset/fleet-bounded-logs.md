---
"@shivaedev/work-fleet": patch
---

### Fixed

- Log invalid Board metadata once per file content and diagnostic, and warn again after a repaired or removed file becomes invalid again.
- Rotate the supervisor log at 5 MiB, keeping three older files and continuing to capture Fleet, Board and supervisor output.
