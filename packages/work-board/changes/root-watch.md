### Fixed

- Notify live clients and report that watching stopped when an outside process removes the workspace root, including when the filesystem emits no descendant file events.
- Keep live updates active when delayed directory notifications arrive without a change to the watched roots, and notify clients when a populated directory moves or its contents change without individual file notifications.
