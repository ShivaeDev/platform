### Changed

- Recognize regex-literal tests, generator harness parameters and native Effect failure tag handlers in the shared Biome report bridge. Keep invalid test titles, done callbacks and nested component factories reportable.
- Prefix generic binders in CLI baseline and fix helpers, CLI execution, config, decoding, engine session and violation helpers, and import project memoization with `T`, preserving their types and runtime behavior.
- Align the package's agent guidance, README, north star, roadmap and topic references around one opinionated policy with minimal repository setup. Keep the accepted warning, off and consumer Biome-override APIs visible as implementation gaps rather than recommended adoption choices.
- Explain the repository gate through a human introduction, an agent mental model and complete config, local-rule and boundary examples. Add package guidance, a north star and a roadmap, and move the detailed rule, naming, debt and shared-tooling references under `docs/`.
- Publish `docs/` alongside the README; keep agent instructions outside the package tarball.
