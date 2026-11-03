---
"@shivaedev/work-board": minor
"@shivaedev/work-fleet": minor
---

### Breaking

- `@shivaedev/work-board`: Prefix Effect service ids with `@shivaedev/work-board/`. Replace any manually constructed `WorkBoard/<name>` tags with the exported service or `@shivaedev/work-board/<name>`; imports and exported names stay the same.
- `@shivaedev/work-fleet`: Prefix Effect service ids with `@shivaedev/work-fleet/`. Replace any manually constructed `Fleet/<name>` tags with the exported service or `@shivaedev/work-fleet/<name>`. The SQL journal implementation uses `@shivaedev/work-fleet/FleetSessionJournal` to stay distinct from the `SessionJournal` port; use the exported `fleetSessionJournal` layer to provide that port. Imports and exported names stay the same.
