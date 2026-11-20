---
"@shivaedev/errors": patch
---

### Fixed

- `redactText` masks GitHub, Stripe, AWS access key id and Slack tokens recognised by their prefix and length when no name stands in front of them.
- `redactText` reads a name right after a literal `\n`, `\r` or `\t` escape, so `\npin=1234` or `\tsession=\"a b\"` inside escaped text has its value masked.
