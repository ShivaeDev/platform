---
"@shivaedev/work-fleet": patch
---

### Fixed

- Keep daemon status overviews responsive with 2,000 stored records by reading operator fields without prompts, Board context, archived cycles or worker output. Show at most 50 completed items, newest first, while retaining all active and waiting work. Targeted `status <id> --json` includes the full stored record in `record`.

### Breaking

- Overview decisions omit `publicationWork` and `published`, and completed work is limited to the newest 50 items. Consumers that need full decision context or older completed records should request `daemon.status` with `workId` and read `record` (or use `fleet.get`).
