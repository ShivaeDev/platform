import { expect } from "vitest";
import { storySpecs } from "#rules/stories/specs.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { prerequisiteFiles, spec } from "#test/storySpecFiles.ts";

const PLAIN = 'import { it } from "vitest"; it("plain", () => {});';

ruleStory.it(
	"tests/story-specs exempts the test-story workspace package by its manifest name, whatever its directory",
	[
		repositoryHas(
			{ content: '{"workspaces":["packages/*"]}', path: "package.json" },
			{ content: '{"name":"@shivaedev/test-story"}', path: "packages/story-runtime/package.json" },
			spec(PLAIN, "packages/story-runtime/src/runtime.test.ts"),
			spec(PLAIN, "src/orders.test.ts"),
		),
	],
	function* ({ check, locations }) {
		yield* check(storySpecs);

		expect(yield* locations()).toEqual(["src/orders.test.ts:1"]);
	},
);

ruleStory.it(
	"tests/story-specs exempts test-story's own tests when it is the repository root",
	[repositoryHas({ content: '{"name":"@shivaedev/test-story"}', path: "package.json" }, spec(PLAIN))],
	function* ({ check }) {
		expect(yield* check(storySpecs)).toEqual([]);
	},
);

for (const [module, route] of [
	["engine", "a dependency"],
	["types", "a peer dependency of its dependency"],
] as const) {
	ruleStory.it(
		`tests/story-specs exempts modules/${module}, which test-story reaches through ${route}`,
		[repositoryHas(...prerequisiteFiles, spec(PLAIN, `modules/${module}/src/engine.test.ts`))],
		function* ({ check }) {
			expect(yield* check(storySpecs)).toEqual([]);
		},
	);
}

for (const [module, relation] of [
	["app", "depends on test-story"],
	["unrelated", "has a similar name to test"],
	["quality", "is a development dependency of test-story"],
	["optional", "is an optional dependency of test-story"],
] as const) {
	ruleStory.it(
		`tests/story-specs checks modules/${module}, which ${relation}`,
		[repositoryHas(...prerequisiteFiles, spec(PLAIN, `modules/${module}/src/engine.test.ts`))],
		function* ({ check, locations }) {
			yield* check(storySpecs);

			expect(yield* locations()).toEqual([`modules/${module}/src/engine.test.ts:1`]);
		},
	);
}
