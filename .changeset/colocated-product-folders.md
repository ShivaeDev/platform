---
"@shivaedev/quality": patch
---

### Changed

- Treat `test`, `tests` and `spec` as test folders only when their directly contained checked files are all tests or test support, allowing colocated specs in product folders that also contain source. `__tests__` remains a test folder everywhere.
