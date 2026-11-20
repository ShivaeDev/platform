---
"@shivaedev/sql": minor
---

### Breaking

- A repository's `delete` and `deleteBatched` refuse a filter without a defined entry. Before, `delete({})` or `delete({ ownerId: maybeOwner })` with an undefined owner removed every row of the table; now TypeScript refuses `{}` and a filter whose every entry may be `undefined`, and at run time such a filter fails with `SchemaError` and removes nothing. To delete every row on purpose, pass `allRows` from `@shivaedev/sql/allRows.ts`: `delete(allRows)` or `deleteBatched({ ...limits, where: allRows })`.
