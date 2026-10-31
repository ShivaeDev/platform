# Changelog

## 0.2.1 - 2026-10-31

### Fixed

- Include `CHANGELOG.md` in published package contents so release notes are available in `node_modules`.
- Release checks reject published package `files` lists that omit `CHANGELOG.md`, naming the package and how to include it.

## 0.2.0 - 2026-10-30

### Added

- Opt-in `--live-notes` smoke check for the running starter: verify a second tab receives a socket hint and rereads a created note without navigation, then loses its live socket and private notes after sign-out in the first tab. Use an existing disposable user through `BROWSER_CHECK_EMAIL` and `BROWSER_CHECK_PASSWORD`.

## 0.1.0 - 2026-10-30

### Added

- Inspect running apps locally with browser-check screenshots, test-user sign-in and smoke checks, installing Chromium only when the command runs.
- Give generated apps an opt-in browser-check script and ignored screenshot folder, outside app CI and ready checks.
