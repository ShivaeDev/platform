### Fixed

- Work with unmet dependencies no longer blocks ready work in the same area, including when an existing waiter becomes blocked. Eligible waiters retain their queue order. Area queue checks read only earlier waiters, so an unreadable later item cannot block ready work ahead of it.
- Repairs and continuations of current area holders skip waiter eligibility reads, so an unreadable earlier waiter cannot prevent them from continuing. Work that must reacquire an area still checks earlier waiters and storage ownership.

### Added

- Export `holdsAreas(record, now, mergeWaitMs)` from `scheduling/areas.ts` to share Fleet's area ownership predicate.

### Breaking

- Remove `FleetRecord.admissionReady` and `FleetCycleSnapshot.admissionReady`; the database migration drops their current and archived columns. `LaunchAdmission.areaWaiters` and `AdmissionLimits.scheduling.waiters` are now required lists of eligible work IDs.
