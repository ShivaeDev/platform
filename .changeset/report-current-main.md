---
"@shivaedev/work-fleet": patch
---

### Fixed

- Report workers fetch and research current main, receive the expected base commit, and report their checked revision. Fleet persists that revision and raises a decision instead of delivering reports from an older, divergent or unidentified checkout.
