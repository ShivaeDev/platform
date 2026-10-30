---
"@shivaedev/skills": patch
---

### Fixed

- Report unreadable skill copies and ownership paths as filesystem failures; only `NotFound` means missing. Preserve read and decode failures as non-enumerable causes in `SkillsError` and include their details in manifest error messages.
