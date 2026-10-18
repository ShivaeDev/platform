---
"@shivaedev/effect-react": minor
---

### Added

- `usePendingCommand`, `PendingCommandOptions` and `PendingCommandState` from `client/pendingCommand.ts` expose a command's wanted display value while it runs and its watched queries refetch, then adopt the server value. Typed command failures revert the display and remain in the native action result.
