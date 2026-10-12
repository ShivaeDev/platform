### Changed

- `testProjects` gives each test 30 seconds instead of Vitest's 5-second default, so tests that start servers, browsers or CLIs no longer time out on a busy CI runner.
