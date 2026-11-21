---
"@shivaedev/server": patch
---

### Fixed

- A host with a deferred `application` Effect runs that Effect and its database inside the host's redaction policy. Logs written while it runs, by a fiber it forks or through a context a service captured there are now masked with the built-in credential-shaped name rules and the fields that the models of its repositories mark sensitive, as a served operation's logs are. Before, those lines went to the installed loggers in clear.

### Changed

- In the deferred `application` form, the spans of the database and of the `application` Effect, such as migrations, pool start-up and fibers they fork, are now exported through the host's OTLP pipeline, or recorded in the local trace store, as a host built from modules already did, so operators see spans they did not see before.
