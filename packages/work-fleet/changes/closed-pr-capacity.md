### Fixed

- Release foreign reservations when the existing delivery observation confirms their PR closed without merging, freeing open-PR backlog for waiting work. Repeated idle reconciliation emits no redundant reservation commit notifications. Releasing the closure decision keeps the reservation absent without another GitHub read. Closed delivery decisions use the `pr-closed` code.
