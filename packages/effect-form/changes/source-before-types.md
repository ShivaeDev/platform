### Fixed

- TypeScript projects that set the `source` condition, as the starter does, read effect-form's types from its source modules only, instead of mixing them with the built declarations and losing field inference in the React hooks.
