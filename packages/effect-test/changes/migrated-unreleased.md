### Changed

- Name descriptive generic type parameters with a `T` prefix, preserving test runner types and behavior.
- Verify conditional skipping in an isolated Vitest fixture, with passing suite assertions for registration and body non-execution instead of a skipped suite test.
- Explain the runner's purpose, service and test lifetimes, clock choices and typed readiness polling in the README, agent north star and package docs; publish `docs/` with the README.
- Build package JavaScript, declarations and source maps with TypeScript 7.
