### Added

- `appHost` accepts an optional native HTTP router layer through `routes`, so application endpoints such as Better Auth share the RPC and asset host.
- `appHost.assets` also accepts native static-server options, including `spa: true` for browser route deep links. Existing directory strings keep their behavior.
