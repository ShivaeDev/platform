---
"@shivaedev/quality": minor
---

### Added

- `quality ci --coverage` collects V8 coverage and JUnit from the gate's single test run into `coverage/lcov.info` and `coverage/junit.xml`, including failed tests. Quality provides the V8 coverage dependency, and `appTestConfig` accepts native coverage options through its second argument.
