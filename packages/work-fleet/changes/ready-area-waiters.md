### Fixed

- Work with unmet dependencies no longer blocks ready work in the same area, including when an existing waiter becomes blocked. Eligible waiters retain their queue order. Area queue checks read only earlier waiters, so an unreadable later item cannot block ready work ahead of it.

### Breaking

- Remove `FleetRecord.admissionReady` and `FleetCycleSnapshot.admissionReady`; the database migration drops their current and archived columns. `LaunchAdmission.areaWaiters` and `AdmissionLimits.scheduling.waiters` are now required lists of eligible work IDs.
