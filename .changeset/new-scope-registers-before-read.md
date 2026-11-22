---
"@shivaedev/contract": patch
---

### Fixed

- A live query whose read keys come from `serverReads` now shows a change that another writer makes to a record in a just-created member of its scope, such as a new list, right after the subscription's rerun has read that member. Before, the open subscription kept the member's old record until the next change to a key it already followed.
