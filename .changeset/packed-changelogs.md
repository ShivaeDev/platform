---
"@shivaedev/access": patch
"@shivaedev/admin": patch
"@shivaedev/browser-check": patch
"@shivaedev/errors": patch
"@shivaedev/github": patch
"@shivaedev/http": patch
"@shivaedev/identity": patch
"@shivaedev/mcp": patch
"@shivaedev/server": patch
"@shivaedev/webhooks": patch
"@shivaedev/releases": patch
---

### Fixed

- Include `CHANGELOG.md` in published package contents so release notes are available in `node_modules`.

- Release checks reject published package `files` lists that omit `CHANGELOG.md`, naming the package and how to include it.
