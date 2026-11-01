---
"@shivaedev/test-story": patch
"@shivaedev/test": patch
"@shivaedev/quality": patch
---

### Changed

- Story kits and the Effect test adapter import native Effect submodules instead of whole barrels. Cookie windows, member windows, React mounting and OTLP decoding load when used; browser RPC imports use dedicated modules.
- App test workers reuse Node's on-disk compilation cache while keeping Vitest's file isolation.
