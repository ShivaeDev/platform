---
"@shivaedev/identity": patch
---

### Fixed

- Validate GitHub ids in `AllowedAccounts` as decimal digits so a login such as `github:octocat` refuses boot with a `ConfigError` naming the entry and expected format. Providers without a known format continue to accept any non-empty id.
