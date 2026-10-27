---
"@shivaedev/work-fleet": minor
---

### Added

- Stop active work in any stage, interrupting its provider turn and releasing its areas and execution slot with a closing cancellation response on Board. Preserve open pull requests and print their URL.
- Stop active work automatically when its Board brief is dropped, and abandon unconfirmed turns after a bounded wait so late output cannot hold the queue.

### Breaking

- `Fleet.stop` now completes cancellation and returns released work. Use its result directly instead of resolving a separate release response. Custom Board gateways implement `respond` to persist its closing response.
- The `daemon.stop` response can be a released preparation summary when a dispatch was stopped before its Fleet record existed. Clients must use the shared `workId`, `stage` and `releaseReason` fields, and query `fleet.get` separately when they need a prepared record. Dispatch status also includes `cancelled`.
