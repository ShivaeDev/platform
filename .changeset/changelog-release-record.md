---
"@shivaedev/changesets": minor
---

### Breaking

- `apply` no longer writes the `release` JSON file in `.changeset/`, and `check` no longer reads it. Consumers should delete that file after their next release. Checks derive releases from deleted base changesets, package versions and dated changelog headings. New packages release from the `0.0.0` placeholder, with consumed changesets present at the base.
