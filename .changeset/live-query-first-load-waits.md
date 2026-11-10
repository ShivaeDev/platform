---
"@shivaedev/contract": patch
---

### Fixed

- A live query reports `waiting: true` from mount until its subscription delivers the first result. It used to report a non-waiting initial result while the subscription opened, so `useQuery`'s `pending` and screen pending signals read a loading query as idle.
