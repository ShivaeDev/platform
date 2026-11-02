---
"@shivaedev/test-story": patch
---

### Fixed

- Keep member screen dialog queries inside the member's root, including when the driver uses a child mount. Mount member portals inside `member.root` so their controls remain accessible to that member. Standalone screen drivers continue to find document portals.
