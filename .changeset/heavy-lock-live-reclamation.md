---
"@shivaedev/heavy-lock": minor
---

### Breaking

- Reclamation uses a shared `<lock>.reclaim` directory and checks ownership before removing a stale file, so competing reclaimers never displace a live holder. Stop participants and upgrade every implementation sharing a lock path to the documented gate protocol before restarting them; implementations that rename the lock during reclamation cannot safely participate.

### Fixed

- Remove draft lock files after partial writes, acquisition failures and interruption.
- Report draft and reclamation-gate cleanup failures as acquisition failures, rolling back any newly acquired hold. Scoped release failures surface as defects containing a `HeavyLockError` and preserve a work failure alongside the cleanup failure.
