---
"@shivaedev/create-app": minor
---

### Added

- Generated apps' route shell steps aside for a full-screen route. A route that sets `fullScreen: true` in TanStack Router's `staticData`, or sits under a parent route that does, renders without the shell's Main navigation and footer, including while that route is still loading on a cold open. The shell's loading line and the modules' overlays stay. `src/client/Module.ts` types the flag beside the module slots.
