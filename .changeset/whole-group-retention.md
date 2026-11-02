---
"@shivaedev/sql": minor
---

### Added

- `deleteGroupsBatched` selects an ordered prefix of whole groups within per-batch and total row budgets, then deletes each batch in an independent transaction. Group selection and deletion use native Effects and SQL; repository deletes publish item and bucket refreshes after commit. A failed batch rolls back its deletes and announcements while preserving earlier batches.
