### Added

- `appHost` and its options types accept an omitted `services` Layer for apps without services of their own. Existing service Layers keep their behavior, and migrated hosts still provide database services to handlers.
