### Added

- `importsManifest` in `rules/imports/manifest.ts` is a `Rule<"imports/manifest", undefined>` enabled by default. It checks workspace imports against the importing package's `dependencies`, `peerDependencies` and `optionalDependencies` without configuration or a package scope convention. Tests, `test-support`, package-root `script`, `scripts` and `tooling` folders and package-root config files may also use `devDependencies`. The rule checks type imports and unresolved workspace package names as well as resolved aliases and relative paths.
