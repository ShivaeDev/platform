---
"@shivaedev/contract": minor
---

### Added

- Return a command's success through `commandResult({ result, invalidates })` to contribute server-only refresh keys from database lookups. The command guard combines them with declared keys through the existing after-commit publication path, discards them on handler failure, and sends only the declared result to the client.
