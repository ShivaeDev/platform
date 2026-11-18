---
"@shivaedev/test-kits": minor
---

### Breaking

- `layerMemoryProtocol(group)` runs the application host's `schemaSensitiveKeys` check over the group before it serves, and dies with the host's `SensitiveFieldConflict` or `InvalidRedactionMask` and its message. A spec can newly fail only for a group the host already refuses to start with: follow the message, which names both schema paths, and rename one field or mark both sensitive. When the host resolves the conflict through `config.sensitiveKeys`, pass the same list as `layerMemoryProtocol(group, { sensitiveKeys })`.
- `@shivaedev/errors` is a peer dependency. Applications that install `@shivaedev/platform` already have it; a library that installs test-kits directly adds `@shivaedev/errors`.
