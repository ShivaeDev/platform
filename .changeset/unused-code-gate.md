---
"@shivaedev/quality": minor
---

### Added

- Report unused files, exports and package dependencies, and missing dependencies with the knip-backed `code/unused` rule. Package exports, binaries, scripts, tests, stories and test support supply entry points without a knip config. Run `quality baseline write --rule code/unused` to record existing findings, then remove debt and run `quality baseline tighten` as you repair it.
