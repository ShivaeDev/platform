import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const named = [
	["src/liveQueryWindow.ts", "export const liveQueryWindow = 30;\n"],
	["src/timeout.ts", "export const timeout = 30;\n"],
	["src/liveQueryWindow.ts", "export const liveQueryWindow = { milliseconds: 30 };\n"],
	["src/liveQueryWindow.ts", "const window = 30;\nexport { window as liveQueryWindow };\n"],
	["src/queries/window.ts", "export const queryWindow = 30;\n"],
] as const;

for (const [path, content] of named) {
	ruleStory.it(`files/named-after-export accepts ${path} holding ${content.trim()}`, [repositoryHas({ content, path })], function* ({ check }) {
		yield* assertThat(yield* check(namedAfterExport), (actual) => actual.toEqual([]));
	});
}

const misnamed = [
	["src/window.ts", "export const liveQueryWindow = 30;\n", '"window" does not name its export liveQueryWindow.'],
	["src/maxItems.ts", "export const MAX_ITEMS = 10;\n", '"maxItems" does not name its export MAX_ITEMS.'],
	["src/queries/queryWindow.ts", "export const queryWindow = 30;\n", '"queryWindow" repeats its folder "queries".'],
	[
		"src/Limits.ts",
		"export const MAX_ITEMS = 10;\nexport const MAX_DEPTH = 4;\n",
		'"Limits" exports several things, so it is a topic file named in camelCase',
	],
	["src/Limits.ts", "export const MAX_ITEMS = 10, MAX_DEPTH = 4;\n", '"Limits" exports several things, so it is a topic file named in camelCase'],
] as const;

for (const [path, content, reason] of misnamed) {
	ruleStory.it(`files/named-after-export refuses ${path}: ${reason}`, [repositoryHas({ content, path })], function* ({ check, messages }) {
		yield* check(namedAfterExport);

		yield* assertThat(yield* messages(), (actual, expect) => actual.toEqual([expect.stringContaining(reason)]));
	});
}

for (const otherExport of ["", "export function available() { return MAX_ITEMS; }\n"]) {
	ruleStory.it(
		`files/named-after-export keeps a constant's filename when it becomes private ${otherExport === "" ? "with no remaining export" : "beside a remaining function export"}`,
		[repositoryHas({ content: `export const MAX_ITEMS = 10;\n${otherExport}`, path: "src/MaxItems.ts" })],
		function* ({ check, writes }) {
			yield* assertThat(yield* check(namedAfterExport), (actual) => actual.toEqual([]));

			yield* writes({ content: `const MAX_ITEMS = 10;\n${otherExport}`, path: "src/MaxItems.ts" });

			yield* assertThat(yield* check(namedAfterExport), (actual) => actual.toEqual([]));
		},
	);
}

ruleStory.it(
	"files/named-after-export still rejects a private constant's unrelated PascalCase filename",
	[repositoryHas({ content: "const MAX_ITEMS = 10;\n", path: "src/Limits.ts" })],
	function* ({ check, locations }) {
		yield* check(namedAfterExport);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/Limits.ts"]));
	},
);
