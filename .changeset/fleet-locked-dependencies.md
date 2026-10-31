---
"@shivaedev/work-fleet": patch
---

### Fixed

- Install locked dependencies when the served checkout's pnpm lockfile changes before rebuilding the Work Board plugin and restarting Fleet and Board. Log failed installs and keep the running services up.
