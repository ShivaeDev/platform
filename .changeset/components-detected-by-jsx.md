---
"@shivaedev/quality": minor
"@shivaedev/react": patch
---

### Added

- `@shivaedev/quality`: `react/nested-components` reports a component or hook defined inside another function. A component is a PascalCase function or class that returns JSX (directly, in a branch or an array, through a `const` that holds it, from a callback such as the one given to `.map`, or through `createElement`), or one that the same function renders as an element, passes as a JSX attribute value or gives to `createElement`, so a function under a PascalCase key that returns no JSX, such as a failure handler keyed by an error tag (`failures: { SubtitleRejected: (error) => ({ field: "title", message: error.message }) }`) or an Effect `catchTags` handler, is no longer reported.

### Breaking

- `@shivaedev/quality`: the Biome preset leaves `noNestedComponentDefinitions` and `noComponentHookFactories` off, because `react/nested-components` replaces them. Baseline entries for `biome/lint/correctness/noNestedComponentDefinitions` or `biome/lint/correctness/noComponentHookFactories` no longer cover anything: run `quality baseline write --rule react/nested-components` to record the nested components they covered under the new rule, then `quality baseline prune` to drop the old entries.

### Changed

- `@shivaedev/react`: from this version, with the `@shivaedev/quality` release of this change, write a `failures` handler inline in the component: `useEditor(api.retitle, { query, fixed: { id }, failures: { SubtitleRejected: (error) => ({ field: "title", message: error.message }) } })`. The 0.50.0 note said to declare a handler such as `onTitle` or `couldNotRemove` outside the component because Biome's `noNestedComponentDefinitions` read it as a component; that is no longer needed, and the README now shows the inline form.
