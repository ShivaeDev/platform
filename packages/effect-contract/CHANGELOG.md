# Changelog

## Unreleased

### Changed

- Validate packed consumers and executable bins through the shared workspace gate.

## 0.1.0 - 2026-09-26

### Added

- Declare queries and commands with typed rejections and reactivity keys; group
  them into a native `RpcGroup` with namespaced tags.
- Bind a contract to a native `AtomRpc` service: query atoms register declared
  read keys; command runs invalidate declared keys after success.
