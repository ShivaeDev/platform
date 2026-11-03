---
"@shivaedev/webhooks": minor
---

### Added

- Select a PostgreSQL schema with `webhookReceipts({ schema })` and the matching `webhookRoute({ receiptsSchema })` option. The component creates the schema and keeps receipts and their migration ledger there. Omitted options preserve unqualified table names and PostgreSQL search-path behavior.

### Breaking

- `webhookReceipts` is now a component factory. Replace `components: [webhookReceipts]` with `components: [webhookReceipts()]`, or pass `{ schema }` to choose a schema. Existing receipts are not moved when a different schema is chosen.
