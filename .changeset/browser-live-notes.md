---
"@shivaedev/browser-check": minor
---

### Added

- Opt-in `--live-notes` smoke check for the running starter: verify a second tab receives a socket hint and rereads a created note without navigation, then loses its live socket and private notes after sign-out in the first tab. Use an existing disposable user through `BROWSER_CHECK_EMAIL` and `BROWSER_CHECK_PASSWORD`.
