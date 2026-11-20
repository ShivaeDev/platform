---
"@shivaedev/identity": minor
"@shivaedev/react": minor
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/identity`: `SessionMemory` in `client/SessionMemory.ts` is the port for the last verified session on a device, with `recallSession`, `rememberSession` and `forgetSession`, the one wipe behind sign-out, another user, a signed-out answer and a passed expiry. It keeps the user id, the session id, the permissions and the session's expiry, never a credential. `browserSessionMemory` in `client/adapters/browserSessionMemory.ts` stores it in `localStorage`.
- `@shivaedev/react`: `authSession(read, { remember: browserSessionMemory })` answers at once with the remembered session, marked as refreshing, and checks the session in the background, so `SessionBoundary` renders and the live socket opens while the check is on the wire. The same user keeps the generation with refreshed permissions, another user starts a new one, a signed-out answer wipes the memory before the signed-out screen renders, a failed check keeps the remembered session rendering, and past the remembered expiry the launch waits for the check. With `remember`, the session's value is `RememberedSession | null`.
- `@shivaedev/react`: `useGuardRerun(router, session)` in `adapters/useGuardRerun.ts` runs a router's guards again when the session's grants change without a navigation, so a screen that needs a removed grant is replaced by the refusal.

### Changed

- `@shivaedev/create-app`: generated apps start from the last verified session, so a returning person never sees "Checking your session…" and an offline launch shows the app instead of "Could not check your session."; their router reruns its guards when the session's grants change.
