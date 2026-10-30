---
"@shivaedev/create-app": minor
---

### Fixed

- Keep template preparation and rendering failures as non-enumerable causes, name the failed step and file, and include the cause in CLI error logs.

### Breaking

- `appFile` validates `package.json` with the starter's concrete manifest schema. Use manifests from `packTemplate`, or supply the complete starter manifest shape with string-valued dependency, script, import and engine maps instead of arbitrary JSON objects.
