import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { programmaticEntries } from "#test/programmaticEntries.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

ruleStory.it(
	"files/named-after-export accepts bundled main and preload roles while checking ordinary modules",
	[programmaticEntries()],
	function* ({ check, locations }) {
		yield* check(namedAfterExport);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/desktop/src/abandoned.ts", "apps/desktop/src/unshipped.ts"]));
	},
);

for (const path of ["apps/server/src/fixture-main.ts", "apps/testing/src/entry.ts"]) {
	ruleStory.it(
		`files/named-after-export accepts the programmatic entry ${path}`,
		[
			repositoryHas(
				{ content: '{"name":"workspace","scripts":{"build":"node script/build.ts"}}', path: "package.json" },
				{ content: `import { build } from "esbuild"; build({ entryPoints: ["${path}"] });`, path: "script/build.ts" },
				{ content: "export const application = 1;", path },
			),
		],
		function* ({ check }) {
			yield* assertThat(yield* check(namedAfterExport), (actual) => actual.toEqual([]));
		},
	);
}

for (const path of [".dependency-cruiser.ts", "apps/desktop/.dependency-cruiser.ts"]) {
	ruleStory.it(
		`files/named-after-export accepts the tool-discovered ${path}`,
		[repositoryHas({ content: "const configuration = {}; export default configuration;", path })],
		function* ({ check }) {
			yield* assertThat(yield* check(namedAfterExport), (actual) => actual.toEqual([]));
		},
	);
}

for (const [path, content] of [
	["src/index.ts", "export function launch() {}"],
	["src/Application.ts", "export const application = 1;"],
	["src/items/itemList.ts", "export function itemList() {}"],
	["src/dependency-cruiser.ts", "const configuration = {}; export default configuration;"],
	["src/adapters/preload.ts", "export const bridge = 1;"],
] as const) {
	ruleStory.it(
		`files/named-after-export still reports the ordinary module ${path}`,
		[repositoryHas({ content, path })],
		function* ({ check, locations }) {
			yield* check(namedAfterExport);

			yield* assertThat(yield* locations(), (actual) => actual.toContain(path));
		},
	);
}
