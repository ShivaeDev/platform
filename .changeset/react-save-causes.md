---
"@shivaedev/react": minor
"@shivaedev/create-app": minor
---

### Added

- Expose the native submission `cause` on `useEditor`, `useCreate` and `SaveState` so applications can render failures that include defects.

### Fixed

- Ignore repeated sign-out dispatch while sign-out is pending.
- Generated apps send an explicitly signed-out visitor to sign-in when the replacement session receives `Unauthorized` from the notes route.

### Breaking

- `useSignOut` stops follow-up navigation on component unmount or registry disposal. Keep the component mounted until the request completes, or let the replacement session's route policy navigate to sign-in when a session refresh unmounts it first.
