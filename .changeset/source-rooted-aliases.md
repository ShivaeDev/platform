---
"@shivaedev/quality": minor
---

### Added

- `manifests/exports-shape` validates declared `#*.ts` and `#test/*` imports against the source and test-support roots. Use `./src/*.ts` directly or the matching source, types and default conditions for `#*.ts`, and `./src/test-support/*` for `#test/*`. Other aliases remain allowed.
