### Changed

- Prefix generic type parameter names in the Prisma binding, model mappings, transaction helpers and affected test fixtures with `T`; their types and runtime behavior stay the same.
- Explain the package's purpose, model mappings, transaction boundary and test coverage in its README, agent north star and package docs; publish `docs/` with the README while keeping agent instructions out of the package.
- Build package JavaScript, declarations and source maps with TypeScript 7.
