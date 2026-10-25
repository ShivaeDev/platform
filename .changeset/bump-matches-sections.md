---
"@shivaedev/changesets": patch
---

### Fixed

- Reject each pre-1.0 package's patch bump when a changeset contains Added or Breaking notes. Check, plan and apply report the fragment, package, declared bump and required minor bump before combining release requests.
