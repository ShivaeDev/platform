### Changed

- The manifest dependency rule allows development dependencies in source modules explicitly blocked by package exports when runtime code cannot reach them in the scanned import graph. Public modules, transitive imports, re-exports, type references and executable entry points retain the runtime dependency boundary, including executables under tooling folders.
