---
"@shivaedev/quality": patch
---

### Fixed

- Surface knip's error output and exit code when analysis produces no valid report, and reject exits inconsistent with the report.
- Resolve analysis and tool configuration within the checked checkout, including git worktrees nested in another checkout.
- Count migration-folder modules, shadcn UI imports, CSS imports and custom Vitest configurations as entry points so plain apps retain their used dependencies and test support.
