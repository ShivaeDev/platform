---
"@shivaedev/quality": minor
"@shivaedev/identity": minor
"@shivaedev/create-app": minor
---

### Added

- Quality accepts app migrations referencing the auth user id with `ON DELETE CASCADE` or `ON DELETE SET NULL`, while keeping auth reads and writes behind identity.
- Identity exports `userReference` from `server/better-auth/userReference.ts` so app migrations share the user table and id column names.
- Starter notes use a `user_id` foreign key with cascading deletion. A numbered migration renames the existing ownership column and adds the constraint for existing apps.
