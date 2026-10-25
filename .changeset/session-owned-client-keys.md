---
"@shivaedev/effect-react": minor
---

### Added

- Pass the session-owned native registry as the second argument to `SessionBoundary.connect`, allowing session-scoped contracts to bind before screens render. Session replacement and sign-out release their private tracking, live registrations and pending refreshes; existing one-argument callbacks continue to work.
