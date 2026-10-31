---
"@shivaedev/quality": patch
---

### Fixed

- Limit `react/jsx-conditionals` and its mechanical fix to decisions in returned component JSX. Accept JSX built in a `const` before the return, library callbacks and ternaries between plain string or number literals. Document accepted decisions, attributes, extracted components and list separators.
