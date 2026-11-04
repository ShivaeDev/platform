---
"@shivaedev/quality": patch
---

### Fixed

- Let `baseline write --first-adoption` record findings from every rule, including rules that permit config exceptions. A repository without a baseline may record all rules at once; policy upgrades with an existing baseline still name explicit rules, and ordinary later writes still require changed file selections.
