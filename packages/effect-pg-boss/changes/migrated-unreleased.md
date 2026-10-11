### Fixed

- Preserve the literal identifier of each `makePgBoss(identifier)` in its service and Layer types, so a Layer for another jobs definition leaves the required service unprovided at compile time. This is breaking only for code that names the shared `PgBossIdentifier` type; use the definition's literal identifier instead.

### Changed

- Explain the jobs boundary in a package north star, agent guidance, usage guide and roadmap, and publish the guide and `docs/` with the package.
- Build package JavaScript, declarations and source maps with TypeScript 7.
