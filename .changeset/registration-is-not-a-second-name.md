---
"@shivaedev/quality": patch
---

### Quality rules

- `structure/no-barrel` no longer reports an exported const whose value is written `satisfies AppModule`, with `AppModule` imported from `@shivaedev/server/AppModule.ts` by name or through a namespace import, such as `export const water = { module: Water, services: waterRepositories } satisfies AppModule;`. That is the registration build's generator lists in the server's module list, so a module's `server/registration.ts` passes as the generator asks for it. The same object cast `as AppModule`, typed `: AppModule`, written `satisfies` another type or with no `satisfies` is still reported as a second name. An application that recorded such registrations as debt, or listed them by hand in one file to avoid the finding, moves each into its module's `server/registration.ts` and runs `quality baseline prune` to drop the cleared entries.
