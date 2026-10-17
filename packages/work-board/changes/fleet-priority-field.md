### Changed

- Board treats a `fleet-priority` frontmatter field as Fleet-owned, like `fleet-launch` and `fleet-deliverable`, so a task carrying it reads without an unknown-field diagnostic and keeps the field in its source.
