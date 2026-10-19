---
"@shivaedev/quality": minor
---

### Added

- A pure function with no engine behind it gets a plain test in a unit test file, declared with the `unit` modifier: `parse.unit.test.ts` beside `parse.ts`, or `<behaviour>.unit.spec.ts`. `tests/story-specs` accepts plain Vitest tests there and still rejects them in every other test file, so the default answer stays a story.
- `tests/story-specs` rejects a `.unit` file that reaches an engine, directly or through what it imports: Node's file, network, process and worker modules, database clients, HTTP, socket and DOM libraries, and the story runners. It follows runtime imports through Quality's import graph, ignores type-only imports, and names the reached engine and the import chain. When the module under test reaches the engine, the finding asks you to split that module so its pure code can be tested alone.
- `tests/story-specs` also rejects mocking (`vi.mock`, `vi.spyOn`, `vi.fn`, env and global stubs, fake timers), providing services (`Effect.provide*`, `Layer`, `ManagedRuntime`, `it.layer`) and DOM use in a `.unit` file and in the test-support fixtures it imports. Running an Effect that needs nothing, with `Effect.runSync` or `it.effect`, stays allowed.
- `tests/follow` and `tests/colocated` accept `unit` as a test modifier beside `dom`, `slow` and `typecheck`, keep it in the names they suggest, and reject `.unit.dom` because a unit test runs without the DOM. `testProjects()` runs `.unit` files in the Node project. `ENVIRONMENTS` from `naming/testName.ts` now includes `"unit"`.
- Every `tests/story-specs` finding names both repairs: drive the engine through the package's story kit, or, when the code under test is pure, move the test to a `.unit` file.
- To adopt it, rename each baselined plain test of pure code to `<name>.unit.test.ts` (or `.unit.spec.ts`), run `quality lint` to confirm it reaches no engine and mocks nothing, then run `quality baseline tighten` so its `tests/story-specs` entry leaves the baseline and other entries move with the file. Replace a `tests/story-specs` exception kept for pure tests with the same rename.
