---
"@shivaedev/platform": minor
"@shivaedev/test-story": minor
---

### Added

- Platform exports `authTestUtils(options?)` and `signedInUser(auth, fields)` from `server/better-auth/testing.ts` for typed Better Auth test utilities and signed-in story preconditions with user fields and roles, without OAuth or password hashing.
- Test-story exports `seedCookies(cookies)` and `DomCookie` from `seedCookies.ts` to seed happy-dom's cookie container, including HttpOnly session cookies accepted by a real HTTP host.
