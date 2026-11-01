---
"@shivaedev/skills": patch
---

### Fixed

- Allow a failed first sync or a failed sync of newly selected skills to be retried after the copy failure is resolved, while preserving repository-owned skills.
- Refuse sync before changing files when `.agents/skills` and `.claude/skills` resolve to the same directory.
