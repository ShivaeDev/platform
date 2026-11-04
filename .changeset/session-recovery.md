---
"@shivaedev/react": minor
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/react`: `SessionBoundary` accepts a session-check Effect, retries failed checks with exponential backoff, and retries immediately on online or foreground events. Its optional `signOut` atom holds the signed-in tree until the auth owner reports signed out.

### Fixed

- `@shivaedev/react`: Socket transport failures no longer request a session check; typed authentication refusals still do.
- `@shivaedev/create-app`: The starter retains its signed-in screen when session checks cannot reach the server and unmounts signed-in routes during sign-out.
