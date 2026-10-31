---
"@shivaedev/work-fleet": patch
---

### Fixed

- Build the Work Board plugin client bundle before `up` starts Fleet and Board in a Platform checkout, and rebuild it when plugin sources change. Report failed builds in the supervisor log without stopping either service.
