---
"@shivaedev/identity": minor
"@shivaedev/create-app": minor
---

### Added

- Identity mounts accept a configured `accountRoleSeed` to grant a role to named provider accounts at boot and sign-in through the guarded `assignRole` path. The shared `ProviderAccounts` schema accepts empty lists for seeds while `AllowedAccounts` continues to require at least one account.

### Changed

- Generated applications declare their owner seed from `AUTH_OWNER_ACCOUNTS`, with empty and unset lists granting nothing.

### Fixed

- Trusted `assignRole` commands work without an application Reactivity Layer and preserve an existing service for commit invalidation.
