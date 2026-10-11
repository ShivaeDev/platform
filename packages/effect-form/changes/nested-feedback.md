### Added

- `Form.errorAt(path)` reads nested Schema feedback beneath a top-level field, including individual array entries, without adding nested field state. Top-level touch/submission controls visibility; `error(name)` retains aggregated Schema, handler and advisory messages. `messageAtPath(issue, path)` selects the first Schema message at or beneath a path; `schemaFeedback(decoded)` adapts a decoded result atom to aggregated and nested messages.
