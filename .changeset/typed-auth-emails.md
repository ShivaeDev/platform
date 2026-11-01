---
"@shivaedev/identity": minor
"@shivaedev/create-app": minor
---

### Added

- Wire Better Auth's four email callbacks through one `emails` mount option. Deliver typed account confirmation, email-change approval, new-address confirmation, password-reset and existing-account messages with application route links and decoded new addresses.
- Throttle email delivery attempts per account and message kind within a configurable, mount-local window that defaults to one minute.
- Generated starters wire typed, throttled auth emails and provide application confirmation and password-reset routes.
