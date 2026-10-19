---
"@shivaedev/work-fleet": patch
---

### Fixed

- The daemon answers status and follow requests promptly right after a restart with 2,000 stored records. `fleet/status.md` lists the same 50 most recently completed items as `work-fleet status`, newest first, instead of one Done card per completed item, so the daemon no longer re-indexes a file that grows with every finished item. Follow snapshots read attempt rows only for executing work, and records are assembled from their child rows in one pass instead of scanning every child row once per record.
