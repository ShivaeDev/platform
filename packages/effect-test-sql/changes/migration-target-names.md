### Fixed

- The `migrateTo(name: string | number)` helper returned by `migrationSteps` accepts zero-padded migration names as written, unpadded names and bare numeric ids. Unknown or ambiguous targets fail with a typed `MigrationError` naming the requested target.
