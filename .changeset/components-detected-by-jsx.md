---
"@shivaedev/quality": minor
"@shivaedev/react": patch
---

### Added

- `@shivaedev/quality`: `react/nested-components` reports a component or hook defined inside another function. A component is a PascalCase function or class that returns JSX, or one rendered as an element, passed as a JSX attribute or given to `createElement`, so a function under a PascalCase key that returns no JSX, such as a failure handler keyed by an error tag (`failures: { SubtitleRejected: (error) => ({ field: "title", message: error.message }) }`) or an Effect `catchTags` handler, is no longer reported.

### Breaking

- `@shivaedev/quality`: the Biome preset leaves `noNestedComponentDefinitions` and `noComponentHookFactories` off, because `react/nested-components` replaces them. Baseline entries for `biome/lint/correctness/noNestedComponentDefinitions` or `biome/lint/correctness/noComponentHookFactories` no longer cover anything: run `quality baseline write --rule react/nested-components` to record the nested components they covered under the new rule, then `quality baseline prune` to drop the old entries.

### Changed

- `@shivaedev/react`: the README writes a failure handler inline in the component again, `failures: { SubtitleRejected: (error) => ({ field: "title", message: error.message }) }`, instead of declaring it outside the component.
