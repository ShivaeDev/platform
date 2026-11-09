---
"@shivaedev/quality": patch
---

### Fixed

- `code/unused` accepts the dependencies of a package that ships only its manifest. Such a package exports `./package.json` alone and holds no sources, so the dependencies it installs are what it delivers.
