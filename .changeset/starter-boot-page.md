---
"@shivaedev/create-app": minor
---

### Added

- Generated apps' `index.html` marks the saved theme before the bundle runs: an inline script reads the `theme` storage key and sets the `dark` or `light` class on `<html>`, following the system when nothing valid is saved or storage is blocked, by the same rule `src/client/applyTheme.ts` applies once the app starts. A story fails when the script and the module disagree.
- Generated apps' `index.html` holds an outline of the page inside `#root`, styled with the app's Tailwind classes through an `@source` entry in `src/client/main.css`. The app's first render replaces it.

### Changed

- Generated apps' `src/client/main.tsx` starts the app through `startApp` in the new `src/client/startApp.tsx`.
