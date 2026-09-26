# Changelog

## Unreleased

### Changed

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

## 0.1.1 - 2026-09-26

### Changed

- Pin the `react` peer dependency to exactly 19.2.8, the version the package is
  tested against, instead of `^19.2.8`.

## 0.1.0 - 2026-09-26

### Added

- Extract schema-derived form state, submission, field messages, draft
  preservation, and optional React hooks from Antumbra.
- Merge received values per field: untouched fields adopt refreshed server
  values while edited fields keep local input.
- Keep a refresh received during an in-flight save as the baseline instead of
  replacing it with the older submitted values.
- Show an async check message only while the field still holds the value it was
  computed for.
- Clear optional field values and notify subscribers when a received or reverted
  baseline omits the field.
- Allow submit handlers to use the native atom runtime's scope, registry, and
  reactivity services.
