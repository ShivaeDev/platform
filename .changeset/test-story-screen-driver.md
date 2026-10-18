---
"@shivaedev/test-story": minor
---

### Added

- Export `screenDriver(options)`, `ScreenDriverOptions` and `ScreenDriver` from `screenDriver.ts`: narrated DOM clicks, text entry, form submission and screen readouts, with settlement driven by the app's pending signal and an optional renderer `act` adapter. Screens use the existing DOM transport to reach fake HTTP services, including identity providers.
- Screen drivers accept a root getter for document navigation and a per-call `settle({ timeoutMs })` limit.
- Export `routeOutbound(routes)` from `routeOutbound.ts` to scope outbound routing alongside a story's fake HTTP service.
- Screen actions and readouts reject hidden targets and targets inside hidden ancestors; form submission also refuses inert ancestors.
