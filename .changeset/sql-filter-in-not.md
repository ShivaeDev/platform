---
"@shivaedev/sql": minor
---

### Breaking

- A repository filter that puts another key beside an `in` list no longer compiles and fails with `SchemaError` at run time. `{ note: { in: ["paid"], not: null } }` compiled and read the listed rows; remove `not: null`, because a list match already leaves out the rows that hold null.

### Fixed

- `delete` given an `in` list with another key beside it, such as `{ id: { in: [1, 2], gt: 1 } }` built outside an object literal, fails with `SchemaError` and removes nothing instead of removing every listed row.
- A conditional upsert's `updateWhere` fails with `SchemaError` when a key stands beside `excluded`, such as `{ updatedAt: { excluded: "updatedAt", gte: since } }`, instead of comparing only for equality with the incoming value.
- TypeScript refuses a filter object that mixes an `in` list, `not: null` and range or pattern operators on one field; mixes of a range or pattern with `in` or `not` compiled before and failed only at run time.
