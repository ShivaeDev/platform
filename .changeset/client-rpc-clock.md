---
"@shivaedev/contract": minor
"@shivaedev/react": minor
---

### Added

- `@shivaedev/contract/bind.ts` builds a bound HTTP RPC client and atom runtime from a contract and URL, with an inferred request transform for cookies or bearer tokens.
- `@shivaedev/react/client/useNow.ts` exports `useNow(interval, runtime?)` to render the runtime's Effect clock and refresh on the requested interval, including with TestClock.
