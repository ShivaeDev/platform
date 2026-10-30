---
"@shivaedev/access": minor
---

### Breaking

- `roleSet` refuses a role name declared more than once with a compile error. Previously `hasPermission` granted the union of every declaration's grants while `resolve` returned only the first declaration's, so the two disagreed. Merge the grants of repeated roles into one `role(...)` declaration.
- `roleSet` now infers its type parameter from the tuple of roles instead of the union of their names, so `typeof roleSet<TName>` no longer names a role set. Replace `ReturnType<typeof roleSet<TName>>` with `AccessPolicy<TName>` from `@shivaedev/access/roleSet.ts`.
