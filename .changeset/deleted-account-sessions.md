---
"@shivaedev/identity": patch
---

### Fixed

- The account `delete` command works when the auth declaration configures `secondaryStorage`. It previously failed on the `verification` table, which Better Auth does not create there. Inside its transaction it now revokes the person's sessions in `secondaryStorage` as Better Auth does, so none of them resolves a user afterwards, with or without `storeSessionInDatabase`. It records Better Auth's revoked-before time, which alone ends a session created before the deletion, and deletes the listed sessions whether the store's client returns JSON text or parsed values. It also deletes the email codes of their exact address kept there.
