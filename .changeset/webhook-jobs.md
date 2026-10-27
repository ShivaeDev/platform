---
"@shivaedev/jobs": minor
---

### Breaking

- Enqueue inside a provided SQL client's transaction now commits and rolls back with that transaction through pg-boss's per-call database adapter. To retain independent enqueueing, call enqueue after the application transaction returns and handle its failure separately. Outside a transaction, behavior is unchanged.
