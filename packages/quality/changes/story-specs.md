### Added

- Enforce `tests/story-specs`: test files declare tests through a kit built with `@shivaedev/test-story`'s `storyKit`. Typecheck tests, test-story and its transitive workspace dependencies are exempt; existing plain tests can be recorded in the baseline.
- Export `storySpecs` and its matching helpers `storyOrigins`, `storyPrerequisites` and `storyProgram` from their `rules/stories/*.ts` modules.
