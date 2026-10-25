---
"@shivaedev/effect-sql": minor
"@shivaedev/effect-contract": minor
---

### Breaking

- effect-sql writes returning more than 1,000 rows across all chunks of a single call announce `<table>` and `<table>:*` instead of item keys. Code registering raw `<table>:<id>` Reactivity keys outside effect-contract must also register `<table>:*`.

### Added

- effect-contract item reads refresh on their collection-wide `<collection>:*` key, with live hints naming each affected subscribed item.
