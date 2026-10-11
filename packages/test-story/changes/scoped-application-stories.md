### Added

- Story creation, staged hooks, run hooks, traits and bodies can use the runner’s per-test `Scope` without a worker Layer supplying it. Unrelated services still require a matching Layer.
- `StoryKitDefinition.around` wraps creation, staged seeding and the body while leaving worker acquisition outside the wrapper.
- `StoryKitDefinition.clock` selects the kit’s default clock; per-story clock options take precedence.
