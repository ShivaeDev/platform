---
"@shivaedev/quality": patch
---

### Fixed

- `code/unused`: Count declared dependencies named in a Rolldown, esbuild or Bun `external` list as used by the package whose build script bundles them, including lists imported from another module and narrowed with `.filter`. Dependencies that nothing imports or names as external are still reported.
