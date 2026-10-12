### Changed

- The manifest dependency rule allows development dependencies in source modules explicitly blocked by package exports when runtime code cannot reach them in the scanned import graph. Public modules, transitive imports, re-exports, type references and executable entry points retain the runtime dependency boundary, including executables under tooling folders.

### Fixed

- Runtime code in another workspace member also removes the development-dependency exemption from export-blocked bundle inputs it reaches. Cross-member imports from test code retain the exemption.
