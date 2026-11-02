---
"@shivaedev/work-board": patch
---

### Fixed

- Keep lazy chunk reads consistent through loading and recovery so cold loads do not emit conditional React `use` warnings.
