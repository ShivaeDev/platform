---
"@shivaedev/build": minor
---

### Added

- The Vite plugin, `appViteConfig` and the Vitest global setup take the nearest folder at or above Vite's or Vitest's root that holds a `tsconfig.json` as the project, so an application whose root is a folder inside the package, such as `src/client`, gets generation, watching and the bundle check with no option. The bundle check names files and reads `oldFormFolders` entries from that project folder.
- A `tsconfig.json` that holds no files of its own, only references to other projects, is refused with a message that says to run from the package that holds the modules or to give that package a `tsconfig.json` that includes them, instead of finding no module.
