---
"@shivaedev/contract": patch
---

### Fixed

- Automatic live tracking no longer resubscribes, and refetches every tracked query, when a query is read again after the garbage collector reclaimed its atom. A query's tracking id now follows its tag and payload instead of the atom object AtomRpc holds weakly.
