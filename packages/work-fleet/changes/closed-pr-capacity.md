### Fixed

- Release foreign reservations when the existing delivery observation confirms their PR closed without merging, freeing execution capacity and open-PR backlog for waiting work. Closed delivery decisions use the `pr-closed` code.
