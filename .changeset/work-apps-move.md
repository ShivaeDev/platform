---
"@shivaedev/platform": minor
---

### Breaking

- `@shivaedev/work-board`, `@shivaedev/work-fleet` and the Work Board plugin (`@shivaedev/work-board-plugin`) moved to [ShivaeDev/work-apps](https://github.com/ShivaeDev/work-apps), which maintains them under the same npm names, executables and import paths. Their consumers keep their dependencies and change no code; report issues and send changes to that repository. Plugin installs through `--marketplace ShivaeDev/platform` keep working and build the plugin from that repository.
