---
"@shivaedev/identity": minor
"@shivaedev/create-app": minor
---

### Added

- List active sessions with user details and activity times, and revoke one session through the permission-guarded `identity.sessions` contract. Session revocation uses the existing request and live subscription revalidation path.
- Generated applications grant session management to their admin and owner roles.
