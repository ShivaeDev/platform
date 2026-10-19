---
"@shivaedev/effect-contract": patch
"@shivaedev/work-board": patch
---

### Fixed

- effect-contract's `live` coordinator no longer reconciles its read scope when `paused` is read for the first time; a component that showed the pause state while connecting used to make every loaded query read again.
- Opening a Board page sends each read once. The page starts its reads after the live connection's first update, which used to read navigation and watcher state a second time, and a failed connection does not hold the page.
- A file saved again with the same bytes and modification time no longer refreshes open Board pages.
