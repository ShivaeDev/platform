import { expect } from "vitest";
import { storySetup } from "#rules/stories/setup.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const TEST = "src/cart/cart.test.ts";

const STORY_KIT =
	"Name the setup in domain words as traits of the repository's story kit in test-support/, so the test reads as a story: see https://github.com/ShivaeDev/platform/tree/main/packages/quality#story-tests.";

ruleStory.it(
	"tests/story-setup reports a setup helper at its line, names it and points at the story kit",
	[repositoryHas({ content: "import { it } from 'vitest';\n\nfunction setupPaidOrder(): void {}\n", path: "src/orders/checkout.spec.ts" })],
	function* ({ check }) {
		const findings = yield* check(storySetup);

		expect(findings).toEqual([
			{
				file: "src/orders/checkout.spec.ts",
				line: 3,
				message: `Declares the setup helper "setupPaidOrder". ${STORY_KIT}`,
				subject: "setupPaidOrder",
			},
		]);
	},
);

for (const [declaration, helper] of [
	["function seedCart() {}", "seedCart"],
	["export function makeClient() {}", "makeClient"],
	["const buildOrder = () => ({});", "buildOrder"],
	["const setup = function () {};", "setup"],
	["let makeLayer = (() => 1);", "makeLayer"],
	["const seed = async () => {};", "seed"],
] as const) {
	ruleStory.it(
		`tests/story-setup reports ${helper}, declared with ${declaration}, as a setup helper`,
		[repositoryHas({ content: declaration, path: TEST })],
		function* ({ check, messages }) {
			yield* check(storySetup);

			expect(yield* messages()).toEqual([`Declares the setup helper "${helper}". ${STORY_KIT}`]);
		},
	);
}

for (const [lookalike, content] of [
	["names that only start with a helper prefix", "const builder = () => 1;\nfunction settings() {}\nconst makers = () => 1;\n"],
	["constants that hold no function", "const makeup = 1;\nconst seedRows = [1, 2];\n"],
	["a helper inside a describe block", "describe('cart', () => {\n\tconst makeCart = () => ({});\n});\n"],
	["a helper inside a function", "function cartOf() {\n\tfunction seedCart() {}\n\treturn seedCart;\n}\n"],
] as const) {
	ruleStory.it(`tests/story-setup leaves ${lookalike} alone`, [repositoryHas({ content, path: TEST })], function* ({ check }) {
		expect(yield* check(storySetup)).toEqual([]);
	});
}

ruleStory.it(
	"tests/story-setup reports an overloaded setup helper once, at its implementation",
	[
		repositoryHas({
			content: [
				"export function makeClient(url: string): Client;",
				"export function makeClient(url: URL): Client;",
				"export function makeClient(url: string | URL): Client {}",
			].join("\n"),
			path: TEST,
		}),
	],
	function* ({ check, locations }) {
		yield* check(storySetup);

		expect(yield* locations()).toEqual([`${TEST}:3`]);
	},
);

ruleStory.it(
	"tests/story-setup leaves a declared setup function without a body alone",
	[repositoryHas({ content: "declare function setupOrder(): void;", path: TEST })],
	function* ({ check }) {
		expect(yield* check(storySetup)).toEqual([]);
	},
);

const HELPER_AND_WRITE = 'import { writeFileSync } from "node:fs";\nexport function makeTree() {\n\twriteFileSync("a", "");\n}\n';

for (const path of ["src/tree.ts", "src/test-support/tree.test.ts"]) {
	ruleStory.it(
		`tests/story-setup leaves ${path} alone, as it is no test`,
		[repositoryHas({ content: HELPER_AND_WRITE, path })],
		function* ({ check }) {
			expect(yield* check(storySetup)).toEqual([]);
		},
	);
}

ruleStory.it(
	"tests/story-setup checks a test with an environment modifier such as src/tree.dom.test.tsx",
	[repositoryHas({ content: HELPER_AND_WRITE, path: "src/tree.dom.test.tsx" })],
	function* ({ check, locations }) {
		yield* check(storySetup);

		expect(yield* locations()).toEqual(["src/tree.dom.test.tsx:2", "src/tree.dom.test.tsx:3"]);
	},
);
