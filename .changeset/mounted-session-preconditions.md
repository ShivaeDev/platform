---
"@shivaedev/identity": minor
---

### Added

- `passwordUser` accepts `passwordHash` to store a precomputed credential while sign-in still verifies the supplied password.

### Changed

- `signedInUser`, `signInAgain` and `passwordUser` work with the mounted host's own auth without installing a testing plugin or creating another auth instance. Minted sessions run the mounted session hooks and account role seed.

### Breaking

- `signedInUser` and `signInAgain` require the native auth cookie, secret and base URL context instead of only the testing plugin's helpers. Pass the host's `mounted.auth` directly; remove the separate testing auth instance and its `testUtils()` plugin.
