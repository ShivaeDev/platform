---
"@shivaedev/create-app": patch
---

### Changed

- `@shivaedev/create-app` omits unused chart and tooltip components and Recharts from generated apps, and removes the notes table dependency from minimal apps and their starter updates. Generated guidance explains Quality's test naming, the dev server forwards `/health`, and Railway workers use the default restart policy. Existing apps receive the removals through `create-app update`.
