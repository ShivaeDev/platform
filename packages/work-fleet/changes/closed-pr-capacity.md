### Fixed

- Release foreign reservations when the existing delivery observation confirms their PR closed without merging, freeing open-PR backlog for waiting work. Once released, reconciling the closed PR emits no further commit notifications. Closed delivery decisions use the `pr-closed` code.
