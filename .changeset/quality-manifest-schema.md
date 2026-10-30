---
"@shivaedev/quality": minor
---

### Fixed

- Decode package manifests once per scan through a shared Schema, report an invalid manifest once with its path before dependent checks run, and surface read failures instead of treating them as missing files.
- Decode Quality configuration, baselines, registries and declarations directly with Effect Schema.

### Breaking

- Invalid manifest fields now fail `manifests/valid`; correct malformed JSON and manifest field types before running lint or fix. Optional files are absent only for `NotFound`; repair unreadable paths instead of relying on them being ignored.
- `decodeWith` accepts an Effect Schema instead of a Standard Schema; pass the original Effect Schema. Rule option schemas still use Standard Schema.
- `runtimeOf` and `runtimeDeclarationProblems` return Effects; yield their results in Effect programs. `sortingOf` expects validated JSON; validate a manifest through the shared inventory before sorting. `Inventory` includes `manifestFiles`; provide the repository's manifest paths when constructing an inventory.
