---
"@shivaedev/heavy-lock": minor
---

### Added

- Waiting output names the holder's Git branch when available and warns that the holder may be hung after fifteen minutes of holding the lock. Set the Effect API's `hungAfter` duration option to change that threshold. The warning leaves the live holder's lock in place, and holders without branch metadata remain compatible.
