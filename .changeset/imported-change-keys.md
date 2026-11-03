---
"@shivaedev/quality": minor
---

### Added

- Require change collection and bucket names to use their owner's declarations in Reactivity invalidations and mutations, SQL announcements and change-key encoders. The `boundaries/imported-change-keys` rule reports literal array keys, record keys and typed key collection or field names, while accepting imported declarations and literal record IDs and bucket values.
