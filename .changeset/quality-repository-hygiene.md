---
"@shivaedev/quality": minor
---

### Added

- Require exact external dependency pins and pnpm catalog references when catalogs are declared, including exact catalog entries.
- Check repository paths in Markdown backticks and require CLAUDE.md links to the sibling AGENTS.md.
- Check services/<name>/service.ts for a single exported defineService declaration.
- Check selected text files for non-ASCII bytes with files/ascii options.files.
