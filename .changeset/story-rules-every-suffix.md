---
"@shivaedev/quality": patch
---

### Changed

- `tests/domain-outcomes`, `tests/grouped-outcomes` and `tests/wait-on-events` now read every story file, whatever its suffix, so a story named after its module such as `pane.dom.test.ts` follows the same rules as a `.spec.ts`. Type tests, unit tests and `test-support` files stay out of scope. Repair the new findings, or record them with `quality baseline write --rule <rule>` for each of the three rules.
