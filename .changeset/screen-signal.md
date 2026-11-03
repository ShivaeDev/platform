---
"@shivaedev/test-story": minor
"@shivaedev/contract": minor
---

### Added

- `@shivaedev/contract`: Export `activityScreenSignal(activity)` from `clientActivity.ts`, projecting client activity into a native stream and current Effect of pending screen work and hint counts.

### Breaking

- `@shivaedev/test-story`: Screen drivers accept the generic `ScreenSignal` from `server/screenSignal.ts` instead of contract activity directly. Replace `pending: clientActivity(client)` with `pending: activityScreenSignal(clientActivity(client))`; boolean pending streams and callbacks are unchanged. Screen signal states contain `pending: boolean` and a monotonic `hints: number`.
