### Changed

- `imports/runtime` treats packages with a nonempty `bin` entry and no runtime folders as server code. Runtime folders take precedence in packages that also ship browser code.
- Package-root scripts, tooling folders and JavaScript or TypeScript config files are server code; client and shared code cannot import them.
