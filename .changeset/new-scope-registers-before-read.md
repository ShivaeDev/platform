---
"@shivaedev/contract": patch
---

### Fixed

- A live query whose read keys come from `serverReads` now shows a record saved into a just-created member of its scope, such as a new list, when another writer saves it while the subscription is still rerunning for that member. Before, the open subscription kept the list without that record until the next change to a key it already followed.
