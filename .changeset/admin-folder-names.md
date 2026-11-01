---
"@shivaedev/quality": patch
---

### Fixed

- Allow specific admin file names such as `inboxRoutes.ts` inside a module's `client/admin/` and `server/admin/` folders without treating the module name as a repeated prefix. File names must still match their exports.
- Allow a module's client or server registration to import its own admin subtree through `./admin/…`. Other relative imports that leave their folder still require aliases.
