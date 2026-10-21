---
"@shivaedev/work-board": minor
"@shivaedev/work-fleet": minor
---

### Breaking

- Board and Fleet share four document kinds, five authored states, canonical owners, approval and deliverable fields, question scope and urgency, and six Fleet stages. Run `work-board migrate <board dir>` before starting the new version. Old vocabulary is rejected without aliases. Fleet upgrades stored stages through its database migrations. Consumers of detailed engine states use `record.step`; `record.stage` now contains the shared stage.
