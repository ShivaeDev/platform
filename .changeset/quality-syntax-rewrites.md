---
"@shivaedev/quality": minor
---

### Added

- A rule definition may declare `needs`, what it takes from the run: `"story-program"` runs it among the rules that read the story program, which the run builds once for them and drops after the last of them, whatever the rule's tier; `"child-process"` marks a check that runs a child process, such as Biome or Knip.

### Changed

- `effect/rpc-boundary` and `effect/shared-error-classes` read syntax and no longer build a TypeScript program, so a lint takes less time.
- `effect/rpc-boundary` sees `rpcBoundary` and `rpcBoundaryHandlers` imported by name or as a namespace from `@shivaedev/errors`; it no longer follows a boundary re-exported through a local module or assigned to a local alias. A group method named `of` accepts a module only on a group built in it or on a member chain such as `Notes.application.of`, so a service tag's `of` never accepts a module.
- `effect/shared-error-classes` reads literal tags from `TaggedError` and `TaggedErrorClass` constructors, `readonly _tag` literals and subclasses of shared or same-file tagged classes; a tag passed as a constant or through an aliased constructor is no longer seen.
