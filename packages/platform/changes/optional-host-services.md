### Added

- `appHost` and its options types accept an omitted `services` Layer for apps without services of their own. Annotated options require a Layer when they declare service outputs, errors or requirements. Existing service Layers keep their behavior, and migrated hosts still provide database services to handlers.
