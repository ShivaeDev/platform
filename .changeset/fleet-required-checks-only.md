---
"@shivaedev/work-fleet": patch
---

### Fixed

- Gate pull requests and CI repair only on checks required by GitHub branch protection or active rulesets, including repositories with no required checks. Tell workers and reviewers to treat optional app checks as information without waiting, repairing or asking for approval.
