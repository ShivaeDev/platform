### Added

- `appHost({ application, migrations, config? })` evaluates a native Effect returning HTTP host options only after migrations or the schema-current check finishes. Construction keeps typed errors, requirements and scoped resources in the host Layer.
