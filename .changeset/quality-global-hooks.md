---
"@shivaedev/quality": patch
---

### Fixed

- Keep all global Git hooks running after `quality hooks install`, including hooks added later, and prevent recursive pre-commit chaining. Report installations that hide global hooks with a reinstall repair hint; uninstall leaves global hooks in effect.
