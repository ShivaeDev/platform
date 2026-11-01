---
"@shivaedev/admin": minor
---

### Breaking

- Reject overlapping admin route patterns and detail paths outside their page at registry composition. Move colliding pages to distinct routes and place each detail under its page path.

### Fixed

- Apply the first registered page's permission to `/admin` and `/admin/` in both the client and server guards.
- Match detail routes with a declared trailing slash consistently with page routes.
